"""The connection test the onboarding wizard calls before it saves a server.

The wizard must tell "wrong password" from "nothing is listening", and
``online: false`` says only the second. Two things are pinned here:

* **The probe's statuses are the real client's behaviour.** ``online``,
  ``auth_error``, ``timeout`` and ``unreachable`` are checked against a real
  local HTTP server and the real ``HummingbotAPIClient``, not a mock that would
  agree with whatever the classifier assumed about aiohttp's exceptions.
* **The routes keep their promises.** Always a 200 with a status to switch on;
  422 / 429 / 401 only for the request itself; the by-name variant takes the
  stored credentials and no body; and the password appears in no response and no
  log line. Every credential here is a dummy.
"""

import asyncio
import base64
import logging
import socket

import pytest
import pytest_asyncio
from aiohttp import web
from fastapi import FastAPI
from starlette.testclient import TestClient

import condor.server_probe as probe
import condor.web.routes.settings as settings_routes
from condor.server_probe import UserRateLimiter, classify_error, probe_connection
from condor.web.auth import get_current_user
from condor.web.models import WebUser
from config_manager import ServerPermission

USER = WebUser(id=7, username="u", first_name="U", role="user")
OTHER = WebUser(id=8, username="o", first_name="O", role="user")

USERNAME = "dummy-user"
PASSWORD = "dummy-pass-not-real"


# ── A real HTTP server to probe ──


def _authorised(request: web.Request) -> bool:
    expected = base64.b64encode(f"{USERNAME}:{PASSWORD}".encode()).decode()
    return request.headers.get("Authorization") == f"Basic {expected}"


async def _start_server(handler):
    app = web.Application()
    app.router.add_route("*", "/{tail:.*}", handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    return runner, port


async def _accounts(request):
    if not _authorised(request):
        return web.json_response({"detail": "Unauthorized"}, status=401)
    return web.json_response([])


async def _broken(request):
    return web.json_response({"detail": "boom"}, status=500)


async def _hanging(request):
    await asyncio.sleep(10)
    return web.json_response([])


@pytest_asyncio.fixture
async def serve():
    runners = []

    async def start(handler):
        runner, port = await _start_server(handler)
        runners.append(runner)
        return port

    yield start
    for runner in runners:
        await runner.cleanup()


def _closed_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ── probe_connection against the real client ──


@pytest.mark.asyncio
async def test_online(serve):
    port = await serve(_accounts)
    out = await probe_connection("127.0.0.1", port, USERNAME, PASSWORD)
    assert out == {
        "ok": True,
        "status": "online",
        "message": "Connected and authenticated",
    }


@pytest.mark.asyncio
async def test_wrong_password_is_auth_error(serve):
    port = await serve(_accounts)
    out = await probe_connection("127.0.0.1", port, USERNAME, "dummy-wrong")
    assert out["status"] == "auth_error"
    assert out["ok"] is False
    assert out["message"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_refused_port_is_unreachable(monkeypatch):
    # Windows retries a refused SYN for ~2s before it reports the refusal, which
    # is the production connect timeout; give it room so the test sees the
    # refusal itself on every platform (Linux answers at once either way).
    monkeypatch.setattr(probe, "CONNECT_TIMEOUT", 6)
    monkeypatch.setattr(probe, "TOTAL_TIMEOUT", 8)
    out = await probe_connection("127.0.0.1", _closed_port(), USERNAME, PASSWORD)
    assert out["status"] == "unreachable"
    assert out["message"] == "Cannot reach server"


@pytest.mark.asyncio
async def test_no_answer_is_timeout(serve, monkeypatch):
    monkeypatch.setattr(probe, "TOTAL_TIMEOUT", 0.3)
    port = await serve(_hanging)
    out = await probe_connection("127.0.0.1", port, USERNAME, PASSWORD)
    assert out["status"] == "timeout"
    assert out["message"] == "Connection timeout"


@pytest.mark.asyncio
async def test_server_error_is_error(serve):
    port = await serve(_broken)
    out = await probe_connection("127.0.0.1", port, USERNAME, PASSWORD)
    assert out["status"] == "error"
    assert out["message"] == "Server answered unexpectedly"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "username,password", [("", PASSWORD), (USERNAME, ""), ("", "")]
)
async def test_empty_credentials_make_no_network_call(monkeypatch, username, password):
    """A blank template login is its own status and never opens a socket."""
    import hummingbot_api_client

    def boom(**_kw):
        raise AssertionError("a client was built")

    monkeypatch.setattr(hummingbot_api_client, "HummingbotAPIClient", boom)
    out = await probe_connection("127.0.0.1", 1, username, password)
    assert out == {
        "ok": False,
        "status": "not_configured",
        "message": "No credentials saved",
    }


@pytest.mark.asyncio
async def test_password_reaches_no_result_and_no_log(serve, caplog):
    caplog.set_level(logging.DEBUG)
    port = await serve(_accounts)
    outs = [
        await probe_connection("127.0.0.1", port, USERNAME, PASSWORD),
        await probe_connection("127.0.0.1", port, USERNAME, "dummy-wrong"),
        await probe_connection("127.0.0.1", _closed_port(), USERNAME, PASSWORD),
    ]
    blob = repr(outs) + caplog.text
    assert PASSWORD not in blob
    assert "dummy-wrong" not in blob


def test_classifier_reads_the_status_code_not_the_text():
    """A message that merely contains 401 must not read as a bad password."""
    from aiohttp import ClientResponseError, ServerTimeoutError

    assert classify_error(ClientResponseError(None, (), status=401)) == "auth_error"
    assert classify_error(ClientResponseError(None, (), status=500, message="401")) == (
        "error"
    )
    # aiohttp's own timeout is also a connection error: timeout must win.
    assert classify_error(ServerTimeoutError("x")) == "timeout"
    assert classify_error(ConnectionRefusedError()) == "unreachable"
    assert classify_error(ValueError("anything else")) == "error"


# ── rate limiter ──


def test_limiter_blocks_after_limit_and_recovers():
    now = [0.0]
    limiter = UserRateLimiter(limit=2, window=60, clock=lambda: now[0])
    assert limiter.check(1) is None
    assert limiter.check(1) is None
    wait = limiter.check(1)
    assert wait is not None and 1 <= wait <= 61
    assert limiter.check(2) is None  # another user has their own budget
    now[0] = 61.0
    assert limiter.check(1) is None


# ── routes ──


class FakeConfigManager:
    def __init__(self, servers):
        self._servers = servers

    def has_server_access(self, user_id, name, min_permission=None):
        return user_id == USER.id and name in self._servers

    def get_server(self, name):
        return self._servers.get(name)


class ProbeSpy:
    """Stands in for probe_connection, recording what it was given."""

    def __init__(self, status="online"):
        self.status = status
        self.calls = []

    async def __call__(self, host, port, username, password):
        self.calls.append((host, port, username, password))
        return probe.result(self.status)


@pytest.fixture
def env(monkeypatch):
    spy = ProbeSpy()
    cm = FakeConfigManager(
        {
            "local": {
                "host": "localhost",
                "port": 8000,
                "username": USERNAME,
                "password": PASSWORD,
            },
            "blank": {
                "host": "localhost",
                "port": 8001,
                "username": "",
                "password": "",
            },
        }
    )
    monkeypatch.setattr(settings_routes, "probe_connection", spy)
    monkeypatch.setattr(settings_routes, "get_config_manager", lambda: cm)
    monkeypatch.setattr(
        settings_routes,
        "connection_test_limiter",
        UserRateLimiter(limit=3, window=60),
    )
    app = FastAPI()
    app.include_router(settings_routes.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: USER
    return TestClient(app), spy, app


BODY = {"host": "api.example", "port": 8000, "username": USERNAME, "password": PASSWORD}
URL = "/api/v1/settings/servers/test-connection"


@pytest.mark.parametrize(
    "status", ["online", "auth_error", "unreachable", "timeout", "error"]
)
def test_by_address_is_always_200_with_the_status(env, status):
    client, spy, _ = env
    spy.status = status
    resp = client.post(URL, json=BODY)
    assert resp.status_code == 200
    assert resp.json() == probe.result(status)
    assert spy.calls == [("api.example", 8000, USERNAME, PASSWORD)]
    assert PASSWORD not in resp.text


@pytest.mark.parametrize(
    "patch",
    [
        {"port": 0},
        {"port": 70000},
        {"port": "abc"},
        {"host": ""},
        {"host": "http://evil.example"},
        {"host": "a.example/path"},
        {"host": "user@a.example"},
        {"host": "a b"},
        {"host": "x" * 300},
    ],
)
def test_malformed_request_is_422_and_makes_no_call(env, patch):
    client, spy, _ = env
    resp = client.post(URL, json={**BODY, **patch})
    assert resp.status_code == 422
    assert spy.calls == []


def test_missing_field_is_422(env):
    client, spy, _ = env
    resp = client.post(URL, json={k: v for k, v in BODY.items() if k != "password"})
    assert resp.status_code == 422
    assert spy.calls == []


@pytest.mark.parametrize(
    "patch",
    [{"port": 0}, {"host": "a b"}, {"password": "x" * 300}, {"username": "x" * 300}],
)
def test_422_never_echoes_the_password(env, patch):
    client, _, _ = env
    body = {**BODY, **patch}
    resp = client.post(URL, json=body)
    assert resp.status_code == 422
    assert PASSWORD not in resp.text and "x" * 300 not in resp.text


@pytest.mark.parametrize("missing", ["host", "port", "username"])
def test_422_for_a_missing_field_does_not_echo_the_rest_of_the_body(env, missing):
    """For a missing field pydantic's 'input' is the whole body, password included."""
    client, _, _ = env
    resp = client.post(URL, json={k: v for k, v in BODY.items() if k != missing})
    assert resp.status_code == 422
    assert PASSWORD not in resp.text


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "my-host.example", "[::1]"])
def test_plain_hosts_are_accepted(env, host):
    client, spy, _ = env
    assert client.post(URL, json={**BODY, "host": host}).status_code == 200


def test_rate_limit_is_429_with_retry_after(env):
    client, spy, _ = env
    for _ in range(3):
        assert client.post(URL, json=BODY).status_code == 200
    resp = client.post(URL, json=BODY)
    assert resp.status_code == 429
    assert int(resp.headers["Retry-After"]) >= 1
    assert len(spy.calls) == 3  # the refused one never reached the probe
    assert PASSWORD not in resp.text


def test_rate_limit_is_shared_by_both_routes_and_per_user(env):
    client, spy, app = env
    client.post(URL, json=BODY)
    client.post("/api/v1/settings/servers/local/test-connection")
    client.post(URL, json=BODY)
    assert (
        client.post("/api/v1/settings/servers/local/test-connection").status_code == 429
    )
    app.dependency_overrides[get_current_user] = lambda: OTHER
    assert client.post(URL, json=BODY).status_code == 200


def test_not_signed_in_is_401(monkeypatch, env):
    client, spy, app = env
    app.dependency_overrides.clear()
    monkeypatch.setattr("condor.web.auth.decode_jwt", lambda token: None)
    resp = client.post(URL, json=BODY, headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401
    assert spy.calls == []


def test_by_name_uses_stored_credentials_and_no_body(env):
    client, spy, _ = env
    resp = client.post("/api/v1/settings/servers/local/test-connection")
    assert resp.status_code == 200
    assert resp.json() == probe.result("online")
    assert spy.calls == [("localhost", 8000, USERNAME, PASSWORD)]
    assert PASSWORD not in resp.text


def test_by_name_blank_template_credentials_pass_through_as_empty(env):
    """The route hands empty strings on; probe_connection answers not_configured."""
    client, spy, _ = env
    spy.status = "not_configured"
    resp = client.post("/api/v1/settings/servers/blank/test-connection")
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_configured"
    assert spy.calls == [("localhost", 8001, "", "")]


def test_by_name_unknown_server_is_404(env):
    client, spy, _ = env
    resp = client.post("/api/v1/settings/servers/nope/test-connection")
    assert resp.status_code == 404
    assert spy.calls == []


def test_by_name_without_access_is_404_like_unknown(env):
    """No access and no such server look the same: no enumeration."""
    client, spy, app = env
    app.dependency_overrides[get_current_user] = lambda: OTHER
    resp = client.post("/api/v1/settings/servers/local/test-connection")
    assert resp.status_code == 404
    assert (
        resp.json()
        == client.post("/api/v1/settings/servers/nope/test-connection").json()
    )
    assert spy.calls == []


def test_existing_routes_are_not_shadowed(env):
    """POST /servers/{name}/default still routes; test-connection is not a name."""
    paths = {(r.path, tuple(sorted(r.methods))) for r in env[2].routes}
    assert ("/api/v1/settings/servers/{name}/default", ("POST",)) in paths
    assert ("/api/v1/settings/servers", ("POST",)) in paths


@pytest.mark.parametrize("raw", ["not json", "[1, 2]", ""])
def test_a_body_that_is_not_an_object_is_422(env, raw):
    client, spy, _ = env
    resp = client.post(URL, content=raw, headers={"Content-Type": "application/json"})
    assert resp.status_code == 422
    assert spy.calls == []
