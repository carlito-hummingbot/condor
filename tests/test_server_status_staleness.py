"""A dead API must stop reading as "Connected" within seconds (STATUS-STALE).

``SERVER_STATUS`` was cached for 120s and polled every 60s, and a refresh that
fails *before the probe runs* (the client cannot connect at all) leaves the last
good ``online`` in the cache, where ``get_or_fetch`` keeps returning it. These
tests drive a real ``ServerDataService`` with a fake client: the API is up, then
it dies, and the dashboard's two readers (``GET /servers`` and
``GET /servers/{name}/status``) have to follow.
"""

import time

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

import condor.server_data_service as sds_module
import condor.web.routes.servers as servers_routes
from condor.fetchers.server_status import fetch_server_status
from condor.server_data_service import ServerDataService, ServerDataType
from condor.web.auth import get_current_user
from condor.web.models import WebUser

USER = WebUser(id=7, username="u", first_name="U", role="user")
TYPE = ServerDataType.SERVER_STATUS


class FakeAccounts:
    def __init__(self, api):
        self._api = api

    async def list_accounts(self):
        self._api.probes += 1
        if not self._api.up:
            raise ConnectionError("Cannot connect to host")
        return []


class FakeApi:
    """The Hummingbot API: ``up`` flips to simulate it dying."""

    def __init__(self):
        self.up = True
        self.probes = 0
        self.accounts = FakeAccounts(self)


class FakeConfigManager:
    def list_accessible_servers(self, user_id):
        return {"alpha": {"host": "a.local", "port": 8000}}

    def has_server_access(self, user_id, name, min_permission=None):
        return name == "alpha"

    def get_server_permission(self, user_id, name):
        return None

    def get_chat_default_server(self, chat_id):
        return None


@pytest.fixture
def env(monkeypatch):
    api = FakeApi()
    sds = ServerDataService()
    sds.register_fetch(TYPE, fetch_server_status)
    # With the API down the pooled client is gone and reconnecting fails before
    # any probe runs: that is the path that leaves the stale value behind.
    state = {"connect": True}

    async def get_client(server):
        if not state["connect"]:
            raise ConnectionError("Cannot connect to host")
        return api

    monkeypatch.setattr(sds, "_get_client", get_client)
    monkeypatch.setattr(servers_routes, "get_config_manager", FakeConfigManager)
    monkeypatch.setattr(servers_routes, "get_server_data_service", lambda: sds)
    app = FastAPI()
    app.include_router(servers_routes.router)
    app.dependency_overrides[get_current_user] = lambda: USER
    return TestClient(app), sds, api, state


def age_cache(sds, seconds):
    """Make the cached status ``seconds`` old, as if time had passed."""
    entry = sds.get_entry("alpha", TYPE)
    entry.fetched_at -= seconds


def online(client):
    return client.get("/servers").json()[0]["online"]


def test_status_cache_is_short_lived():
    """The badge reads this entry: 2 minutes of staleness is what we fixed."""
    defaults = sds_module._DEFAULTS[TYPE]
    assert defaults.ttl <= 15
    assert defaults.interval <= 15


def test_healthy_server_is_online_with_checked_at(env):
    client, sds, api, _ = env
    before = time.time()
    body = client.get("/servers/alpha/status").json()
    assert body["status"] == "online"
    assert before <= body["checked_at"] <= time.time()
    assert online(client) is True


def test_a_fresh_answer_is_served_without_probing_again(env):
    """Reads inside the TTL cost nothing: the cache still does its job."""
    client, sds, api, _ = env
    client.get("/servers/alpha/status")
    client.get("/servers/alpha/status")
    assert online(client) is True
    assert api.probes == 1


def test_api_dies_and_client_cannot_reconnect_reads_offline(env):
    """The reported bug: a stale ``online`` outliving the API."""
    client, sds, api, state = env
    assert online(client) is True

    api.up = False
    state["connect"] = False
    age_cache(sds, 16)  # past the 15s TTL

    assert online(client) is False
    body = client.get("/servers/alpha/status").json()
    assert body["status"] == "error"
    assert body["message"] == "Server not responding"
    assert body["checked_at"] is not None


def test_api_dies_but_client_connects_reads_offline(env):
    """The pooled-client path: the probe itself fails and says so."""
    client, sds, api, _ = env
    assert online(client) is True

    api.up = False
    age_cache(sds, 16)

    assert online(client) is False
    assert client.get("/servers/alpha/status").json()["status"] == "error"


def test_within_the_ttl_a_just_died_api_is_not_yet_noticed(env):
    """Documents the bound: at most one TTL (15s) of lag, no more."""
    client, sds, api, state = env
    assert online(client) is True
    api.up = False
    state["connect"] = False
    age_cache(sds, 14)
    assert online(client) is True
    age_cache(sds, 2)
    assert online(client) is False


def test_server_comes_back_and_reads_online_again(env):
    client, sds, api, state = env
    assert online(client) is True
    api.up = False
    state["connect"] = False
    age_cache(sds, 16)
    assert online(client) is False

    api.up = True
    state["connect"] = True
    # One failure is a blip, not an outage: the next read re-fetches at once.
    assert online(client) is True
    body = client.get("/servers/alpha/status").json()
    assert body["status"] == "online"


def test_never_probed_server_has_no_checked_at(env):
    client, sds, api, state = env
    state["connect"] = False  # first fetch fails: error-only entry, no value
    body = client.get("/servers/alpha/status").json()
    assert body["status"] in {"error", "unknown"}
    assert online(client) is False


def test_existing_status_fields_are_kept(env):
    """checked_at is additive: status (and message on failure) stay where they were."""
    client, sds, api, _ = env
    body = client.get("/servers/alpha/status").json()
    assert set(body) == {"status", "checked_at"}
    api.up = False
    age_cache(sds, 16)
    body = client.get("/servers/alpha/status").json()
    assert {"status", "message", "checked_at"} <= set(body)


def test_unknown_or_unshared_server_is_still_404(env):
    client, *_ = env
    assert client.get("/servers/nope/status").status_code == 404
