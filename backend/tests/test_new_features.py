"""Tests for iteration 11 additions:
   - POST /api/support/chat (Gemini) — auth + happy path (1 call max)
   - DELETE /api/equipment/{id} — soft delete auth semantics
   - DELETE /api/access/{id}   — soft delete auth semantics + list integrity
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

# Load backend .env so we can seed equipment directly (avoids AI cost)
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

OFFICER_EMAIL = "safety@tk.com"
OFFICER_PW = "test1234"
WORKER_EMAIL = "worker@tk.com"
WORKER_PW = "test1234"
ACCESS_CODE = "TK-SAFETY-2026"


def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    return (r.json()["token"], r.json()["user"]) if r.status_code == 200 else (None, None)


def _register(email, password, name, role, access_code=""):
    return requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": name,
        "role": role, "access_code": access_code,
    }, timeout=30)


def _ensure(email, password, name, role, access_code=""):
    tok, user = _login(email, password)
    if tok:
        return tok, user
    r = _register(email, password, name, role, access_code)
    assert r.status_code == 200, f"seed {email} failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="session")
def officer():
    tok, user = _ensure(OFFICER_EMAIL, OFFICER_PW, "Safety Officer", "Safety Officer", ACCESS_CODE)
    return {"token": tok, "user": user,
            "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def worker():
    tok, user = _ensure(WORKER_EMAIL, WORKER_PW, "Worker", "Worker")
    return {"token": tok, "user": user,
            "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def worker2():
    email = f"TEST_worker2_{uuid.uuid4().hex[:6]}@tk.com"
    tok, user = _ensure(email, "test1234", "TEST Worker 2", "Worker")
    return {"token": tok, "user": user,
            "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


# ---------------------------------------------------------------------------
# Support chat  (LIMIT: 1 real Gemini call across the whole suite)
# ---------------------------------------------------------------------------
class TestSupportChat:
    def test_requires_auth(self):
        r = requests.post(f"{API}/support/chat",
                          json={"message": "How do I run a risk assessment?", "history": []},
                          timeout=30)
        assert r.status_code == 401, r.text

    def test_reply_non_empty(self, worker):
        r = requests.post(f"{API}/support/chat",
                          headers=worker["h"],
                          json={"message": "How do I run a risk assessment?", "history": []},
                          timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reply" in body, body
        assert isinstance(body["reply"], str)
        assert len(body["reply"].strip()) > 0, "empty reply"


# ---------------------------------------------------------------------------
# DELETE /api/equipment/{id}  — soft delete via mongo-seeded doc
# ---------------------------------------------------------------------------
class TestDeleteEquipment:
    def _seed(self, mongo_db, user_id, outcome="PASS"):
        eid = str(uuid.uuid4())
        doc = {
            "id": eid, "user_id": user_id, "outcome": outcome,
            "make": "TEST_Make", "model": "TEST_Model",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_at": None,
        }
        mongo_db.equipment.insert_one(doc)
        return eid

    def test_unknown_id_404(self, worker):
        r = requests.delete(f"{API}/equipment/does-not-exist-{uuid.uuid4().hex}",
                            headers=worker["h"], timeout=15)
        assert r.status_code == 404, r.text

    def test_non_owner_non_privileged_forbidden(self, worker, worker2, mongo_db):
        eid = self._seed(mongo_db, worker["user"]["id"])
        r = requests.delete(f"{API}/equipment/{eid}", headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text
        # still present, still not soft-deleted
        d = mongo_db.equipment.find_one({"id": eid})
        assert d and d.get("deleted_at") is None

    def test_owner_can_delete(self, worker, mongo_db):
        eid = self._seed(mongo_db, worker["user"]["id"])
        r = requests.delete(f"{API}/equipment/{eid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # soft-deleted, not hard-deleted
        d = mongo_db.equipment.find_one({"id": eid})
        assert d and d.get("deleted_at") is not None
        # list only returns non-deleted for privileged; but even officer listing filters deleted
        r = requests.get(f"{API}/equipment", headers=worker["h"], timeout=15)
        # workers get empty (privileged-only list), but ensure no crash + our id not present
        assert r.status_code in (200, 403)
        if r.status_code == 200:
            assert not any(x["id"] == eid for x in r.json())

    def test_officer_can_delete_any(self, worker, officer, mongo_db):
        eid = self._seed(mongo_db, worker["user"]["id"])
        r = requests.delete(f"{API}/equipment/{eid}", headers=officer["h"], timeout=15)
        assert r.status_code == 200, r.text
        # not in officer's equipment list
        r = requests.get(f"{API}/equipment", headers=officer["h"], timeout=15)
        assert r.status_code == 200
        assert not any(x["id"] == eid for x in r.json())


# ---------------------------------------------------------------------------
# DELETE /api/access/{id}  — soft delete + list integrity
# ---------------------------------------------------------------------------
class TestDeleteAccess:
    def _create_signin(self, headers):
        r = requests.post(f"{API}/access", headers=headers,
                          json={"type": "signin"}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_unknown_id_404(self, worker):
        r = requests.delete(f"{API}/access/does-not-exist-{uuid.uuid4().hex}",
                            headers=worker["h"], timeout=15)
        assert r.status_code == 404, r.text

    def test_non_owner_non_privileged_forbidden(self, worker, worker2):
        aid = self._create_signin(worker["h"])
        r = requests.delete(f"{API}/access/{aid}", headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text
        # cleanup by owner
        requests.delete(f"{API}/access/{aid}", headers=worker["h"], timeout=15)

    def test_owner_can_delete_and_list_excludes(self, worker):
        aid = self._create_signin(worker["h"])
        # confirm present before delete
        r = requests.get(f"{API}/access", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == aid for x in r.json()["records"])
        # delete
        r = requests.delete(f"{API}/access/{aid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # excluded from list
        r = requests.get(f"{API}/access", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        body = r.json()
        for k in ("status", "on_site", "records"):
            assert k in body, f"missing key {k}"
        assert not any(x["id"] == aid for x in body["records"])

    def test_officer_can_delete_any(self, worker, officer):
        aid = self._create_signin(worker["h"])
        r = requests.delete(f"{API}/access/{aid}", headers=officer["h"], timeout=15)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/access", headers=officer["h"], timeout=15)
        assert r.status_code == 200
        assert not any(x["id"] == aid for x in r.json()["records"])


# ---------------------------------------------------------------------------
# Dashboard regression (unaffected by new endpoints)
# ---------------------------------------------------------------------------
class TestDashboardRegression:
    def test_dashboard_ok(self, officer):
        r = requests.get(f"{API}/dashboard", headers=officer["h"], timeout=20)
        assert r.status_code == 200, r.text
        for k in ("open_incidents", "active_locks", "assessments_count",
                  "traffic_zones", "on_site", "recent_assessments",
                  "equipment_count", "equipment_hazard"):
            assert k in r.json(), f"missing dashboard key {k}"
