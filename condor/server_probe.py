"""One-shot connection test against a Hummingbot API server.

The onboarding wizard has to tell "the password is wrong" from "nothing is
listening there", and ``GET /servers`` only says ``online: false`` for both. This
module runs a single authenticated call over a throwaway client and sorts the
outcome into a small, stable set of statuses a UI can switch on.

Nothing here reads or writes ``config.yml``, and nothing is cached: the answer
describes the credentials and address it was given, right now. The password is
handed to the client and nowhere else - it is never logged, and an upstream
exception's text (which can carry the backend's address) is never returned, only
the fixed message of the status it maps to.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Deque, Dict, Optional

import aiohttp
from aiohttp import ClientTimeout

logger = logging.getLogger(__name__)

# Statuses a caller can switch on. ``ok`` is True only for ``online``.
ONLINE = "online"
AUTH_ERROR = "auth_error"
UNREACHABLE = "unreachable"
TIMEOUT = "timeout"
ERROR = "error"
NOT_CONFIGURED = "not_configured"

MESSAGES: Dict[str, str] = {
    ONLINE: "Connected and authenticated",
    AUTH_ERROR: "Invalid credentials",
    UNREACHABLE: "Cannot reach server",
    TIMEOUT: "Connection timeout",
    ERROR: "Server answered unexpectedly",
    NOT_CONFIGURED: "No credentials saved",
}

CONNECT_TIMEOUT = 2  # seconds
TOTAL_TIMEOUT = 3  # seconds - a dead host must not hold the wizard for long


def result(status: str) -> dict:
    """The response body for ``status``: ``{ok, status, message}``."""
    return {"ok": status == ONLINE, "status": status, "message": MESSAGES[status]}


def classify_error(exc: BaseException) -> str:
    """Map a failed probe to one status, from the exception's type and fields.

    Reads ``status`` (the code the API answered with) rather than searching the
    message, so a hostname that happens to contain "401" cannot read as a bad
    password. Timeouts are tested first: aiohttp's connect timeout is also a
    connection error, and "no answer" and "refused" call for different advice.
    """
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return TIMEOUT
    if isinstance(exc, aiohttp.ClientResponseError):
        return AUTH_ERROR if exc.status == 401 else ERROR
    if isinstance(exc, (aiohttp.ClientConnectionError, OSError)):
        return UNREACHABLE
    return ERROR


async def probe_connection(host: str, port: int, username: str, password: str) -> dict:
    """Try one authenticated call against ``host:port``; never raises.

    Empty credentials are answered ``not_configured`` without opening a socket:
    a template config leaves them blank on purpose, and sending an empty
    password only produces a misleading 401.
    """
    if not username or not password:
        return result(NOT_CONFIGURED)

    # Imported here, like ConfigManager's own probe, so importing this module
    # never needs the client package.
    from hummingbot_api_client import HummingbotAPIClient

    client = HummingbotAPIClient(
        base_url=f"http://{host}:{port}",
        username=username,
        password=password,
        timeout=ClientTimeout(total=TOTAL_TIMEOUT, connect=CONNECT_TIMEOUT),
    )
    try:
        # Same call as the liveness probes, so every surface agrees on "online".
        async with asyncio.timeout(TOTAL_TIMEOUT + 2):
            await client.init()
            await client.accounts.list_accounts()
        return result(ONLINE)
    except Exception as exc:  # noqa: BLE001 - every failure is a status, not a 500
        status = classify_error(exc)
        # The type only: the text can carry the address, and the client holds
        # the password.
        logger.debug("connection test: %s (%s)", status, type(exc).__name__)
        return result(status)
    finally:
        try:
            await client.close()
        except Exception:  # noqa: BLE001
            pass


class UserRateLimiter:
    """Sliding-window limit per user, in memory.

    The by-address test makes Condor open a connection to a host the caller
    typed, so it must not be usable as a port scanner. A process restart resets
    the window, which is fine for a courtesy limit on a single-node dashboard.
    """

    def __init__(self, limit: int, window: float, clock=time.monotonic):
        self.limit = limit
        self.window = window
        self._clock = clock
        self._hits: Dict[int, Deque[float]] = {}

    def check(self, user_id: int) -> Optional[int]:
        """Record a call; return ``None`` if allowed, else seconds to wait."""
        now = self._clock()
        hits = self._hits.setdefault(user_id, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, int(self.window - (now - hits[0])) + 1)
        hits.append(now)
        return None


#: Shared by both test routes, so alternating them does not double the budget.
connection_test_limiter = UserRateLimiter(limit=10, window=60.0)
