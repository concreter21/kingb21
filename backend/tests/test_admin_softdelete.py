"""Tests for soft-delete, clear-all, and admin 2FA-gated endpoints."""
import os
import uuid
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import asyncio

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "halfbc175@gmail.com"
OWNER_PW = "owner1234"
OFFICER_EMAIL = "safety@tk.com"
OFFICER_PW = "test1234"
WORKER_EMAIL = "worker@tk.com"
WORKER_PW = "test1234"
ACCESS_CODE = "TK-SAFETY-2026"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    return (r.json().get("token"), r.json().get("user")) if r.status_code == 200 else (None, None)


def _register(email, pw, name, role, code=""):
    return requests.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": name, "role": role, "access_code": code}, timeout=15)


def _ensure(email, pw, name, role, code=""):
    tok, user = _login(email, pw)
    if tok:
        return tok, user
    r = _register(email, pw, name, role, code)
    assert r.status_code == 200, f"register {email}: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def owner():
    # owner is the hardcoded owner email; try login, else register as Safety Officer w/ code
    tok, user = _login(OWNER_EMAIL, OWNER_PW)
    if not tok:
        r = _register(OWNER_EMAIL, OWNER_PW, "Owner", "Safety Officer", ACCESS_CODE)
        assert r.status_code == 200, r.text
        tok, user = r.json()["token"], r.json()["user"]
    return {"token": tok, "user": user, "h": _h(tok)}


@pytest.fixture(scope="session")
def officer():
    tok, user = _ensure(OFFICER_EMAIL, OFFICER_PW, "Safety Officer", "Safety Officer", ACCESS_CODE)
    return {"token": tok, "user": user, "h": _h(tok)}


@pytest.fixture(scope="session")
def worker():
    tok, user = _ensure(WORKER_EMAIL, WORKER_PW, "Worker", "Worker")
    return {"token": tok, "user": user, "h": _h(tok)}


@pytest.fixture(scope="session")
def worker2():
    email = f"TEST_w2_{uuid.uuid4().hex[:6]}@tk.com"
    tok, user = _ensure(email, "test1234", "TEST W2", "Worker")
    return {"token": tok, "user": user, "h": _h(tok)}


def _get_otp_code(email):
    async def _q():
        c = AsyncIOMotorClient(MONGO_URL)
        rec = await c[DB_NAME].admin_otps.find_one({"email": email.lower()})
        c.close()
        return rec
    return asyncio.get_event_loop().run_until_complete(_q()) if False else asyncio.new_event_loop().run_until_complete(_q())


@pytest.fixture(scope="session")
def admin_token(owner):
    r = requests.post(f"{API}/admin/request-otp", headers=owner["h"], timeout=15)
    assert r.status_code == 200, r.text
    rec = _get_otp_code(OWNER_EMAIL)
    assert rec and rec.get("code"), "OTP not stored in mongo"
    code = rec["code"]
    r = requests.post(f"{API}/admin/verify-otp", headers=owner["h"], json={"code": code}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json()["admin_token"]
    return {"token": tok, "h": _h(tok)}


# --------------------------------------------------------------------------
# Soft delete
# --------------------------------------------------------------------------
class TestSoftDelete:
    def test_loto_owner_soft_delete(self, worker):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_SD_{uuid.uuid4().hex[:6]}", "machine_name": "TEST_SD_M",
            "location": "TEST", "reason": "TEST", "lock_number": "SD-1"}, timeout=15)
        lid = r.json()["id"]
        r = requests.delete(f"{API}/loto/{lid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200 and r.json().get("ok"), r.text
        # not visible in list
        r = requests.get(f"{API}/loto", headers=worker["h"], timeout=15)
        assert not any(x["id"] == lid for x in r.json()), "soft-deleted loto still in list"

    def test_loto_non_owner_forbidden(self, worker, worker2):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_SD_{uuid.uuid4().hex[:6]}", "machine_name": "TEST_SD_M2",
            "location": "TEST", "reason": "TEST", "lock_number": "SD-2"}, timeout=15)
        lid = r.json()["id"]
        r = requests.delete(f"{API}/loto/{lid}", headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_incident_owner_soft_delete(self, worker):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_SD_inc", "category": "Near Miss", "severity": "Low",
            "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        r = requests.delete(f"{API}/incidents/{iid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        assert not any(x["id"] == iid for x in r.json())

    def test_incident_non_owner_forbidden(self, worker, worker2):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_SD_inc2", "category": "Near Miss", "severity": "Low",
            "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        r = requests.delete(f"{API}/incidents/{iid}", headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_traffic_owner_soft_delete(self, worker):
        r = requests.post(f"{API}/traffic", headers=worker["h"], json={
            "zone_name": f"TEST_SD_z_{uuid.uuid4().hex[:6]}", "zone_type": "pedestrian",
            "risk_note": "TEST", "controls": "TEST"}, timeout=15)
        tid = r.json()["id"]
        r = requests.delete(f"{API}/traffic/{tid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/traffic", headers=worker["h"], timeout=15)
        assert not any(x["id"] == tid for x in r.json())

    def test_traffic_non_owner_forbidden(self, worker, worker2):
        r = requests.post(f"{API}/traffic", headers=worker["h"], json={
            "zone_name": f"TEST_SD_z_{uuid.uuid4().hex[:6]}", "zone_type": "pedestrian",
            "risk_note": "TEST", "controls": "TEST"}, timeout=15)
        tid = r.json()["id"]
        r = requests.delete(f"{API}/traffic/{tid}", headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_officer_can_delete_any_loto(self, worker, officer):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_SD_{uuid.uuid4().hex[:6]}", "machine_name": "TEST_SD_off",
            "location": "TEST", "reason": "TEST", "lock_number": "SD-9"}, timeout=15)
        lid = r.json()["id"]
        r = requests.delete(f"{API}/loto/{lid}", headers=officer["h"], timeout=15)
        assert r.status_code == 200, r.text


# --------------------------------------------------------------------------
# Clear-all
# --------------------------------------------------------------------------
class TestClearAll:
    def test_clear_all_incidents_worker_only_own(self, worker, worker2):
        # worker creates 2, worker2 creates 1
        w_ids = []
        for i in range(2):
            r = requests.post(f"{API}/incidents", headers=worker["h"], json={
                "title": f"TEST_CA_{i}", "category": "Near Miss", "severity": "Low",
                "location": "TEST", "description": "TEST"}, timeout=15)
            w_ids.append(r.json()["id"])
        r = requests.post(f"{API}/incidents", headers=worker2["h"], json={
            "title": "TEST_CA_w2", "category": "Near Miss", "severity": "Low",
            "location": "TEST", "description": "TEST"}, timeout=15)
        other_id = r.json()["id"]
        # worker clears
        r = requests.post(f"{API}/incidents/clear-all", headers=worker["h"], timeout=15)
        assert r.status_code == 200 and r.json().get("ok"), r.text
        assert r.json().get("cleared", 0) >= 2
        # worker's are gone from list; worker2's still there
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        ids = [x["id"] for x in r.json()]
        for wid in w_ids:
            assert wid not in ids
        assert other_id in ids

    def test_clear_all_loto_returns_ok_cleared(self, worker):
        for i in range(2):
            requests.post(f"{API}/loto", headers=worker["h"], json={
                "machine_id": f"TEST_CA_L_{uuid.uuid4().hex[:6]}", "machine_name": "TEST",
                "location": "TEST", "reason": "TEST", "lock_number": f"CA-{i}"}, timeout=15)
        r = requests.post(f"{API}/loto/clear-all", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert "cleared" in r.json() and r.json()["ok"] is True

    def test_clear_all_assessments_ok(self, worker):
        r = requests.post(f"{API}/assessments/clear-all", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_clear_all_equipment_ok(self, worker):
        r = requests.post(f"{API}/equipment/clear-all", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text

    def test_clear_all_unknown_module_404(self, worker):
        r = requests.post(f"{API}/bogusmod/clear-all", headers=worker["h"], timeout=15)
        assert r.status_code == 404, r.text


# --------------------------------------------------------------------------
# Admin 2FA gate
# --------------------------------------------------------------------------
class TestAdmin2FA:
    def test_non_owner_cannot_request_otp(self, worker):
        r = requests.post(f"{API}/admin/request-otp", headers=worker["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_officer_non_owner_cannot_request_otp(self, officer):
        # officer is safety@tk.com — not owner
        r = requests.post(f"{API}/admin/request-otp", headers=officer["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_owner_request_otp_ok_and_stored(self, owner):
        r = requests.post(f"{API}/admin/request-otp", headers=owner["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        assert r.json().get("sent_to", "").lower() == OWNER_EMAIL
        rec = _get_otp_code(OWNER_EMAIL)
        assert rec and rec.get("code") and len(rec["code"]) == 6

    def test_wrong_otp_401(self, owner):
        # ensure a fresh code exists
        requests.post(f"{API}/admin/request-otp", headers=owner["h"], timeout=15)
        r = requests.post(f"{API}/admin/verify-otp", headers=owner["h"],
                         json={"code": "000000"}, timeout=15)
        # accept 401 (may be wrong) or 429 if attempts saturated from prior tests
        assert r.status_code in (401, 429), r.text

    def test_correct_otp_returns_admin_token(self, owner):
        r = requests.post(f"{API}/admin/request-otp", headers=owner["h"], timeout=15)
        assert r.status_code == 200
        rec = _get_otp_code(OWNER_EMAIL)
        r = requests.post(f"{API}/admin/verify-otp", headers=owner["h"],
                         json={"code": rec["code"]}, timeout=15)
        assert r.status_code == 200, r.text
        assert "admin_token" in r.json()


# --------------------------------------------------------------------------
# Admin endpoints (require admin_token)
# --------------------------------------------------------------------------
class TestAdminEndpoints:
    def test_normal_jwt_rejected_users_list(self, worker):
        r = requests.get(f"{API}/admin/users", headers=worker["h"], timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_officer_jwt_rejected(self, officer):
        r = requests.get(f"{API}/admin/users", headers=officer["h"], timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_list_users_no_password_hash(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=admin_token["h"], timeout=15)
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list) and len(users) > 0
        for u in users:
            assert "password_hash" not in u
            assert "email" in u

    def test_create_user_and_duplicate(self, admin_token):
        email = f"TEST_admin_add_{uuid.uuid4().hex[:6]}@tk.com"
        r = requests.post(f"{API}/admin/users", headers=admin_token["h"],
                         json={"email": email, "password": "pw123456", "name": "TEST", "role": "Worker"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email.lower()
        # duplicate
        r = requests.post(f"{API}/admin/users", headers=admin_token["h"],
                         json={"email": email, "password": "pw123456", "name": "TEST", "role": "Worker"}, timeout=15)
        assert r.status_code == 409, r.text

    def test_change_role_valid_and_invalid(self, admin_token):
        # create user
        email = f"TEST_role_{uuid.uuid4().hex[:6]}@tk.com"
        r = requests.post(f"{API}/admin/users", headers=admin_token["h"],
                         json={"email": email, "password": "pw123456", "name": "TEST", "role": "Worker"}, timeout=15)
        uid = r.json()["id"]
        # valid role change
        r = requests.patch(f"{API}/admin/users/{uid}/role", headers=admin_token["h"],
                          json={"role": "Supervisor"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "Supervisor"
        # invalid role
        r = requests.patch(f"{API}/admin/users/{uid}/role", headers=admin_token["h"],
                          json={"role": "GodMode"}, timeout=15)
        assert r.status_code == 422, r.text

    def test_admin_deleted_list(self, admin_token, worker):
        # create + delete an incident to guarantee at least one entry
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": f"TEST_deleted_{uuid.uuid4().hex[:6]}", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        requests.delete(f"{API}/incidents/{iid}", headers=worker["h"], timeout=15)
        r = requests.get(f"{API}/admin/deleted", headers=admin_token["h"], timeout=15)
        assert r.status_code == 200, r.text
        entries = r.json()
        assert any(e["id"] == iid and e["collection"] == "incidents" for e in entries)


# --------------------------------------------------------------------------
# End-to-end restore
# --------------------------------------------------------------------------
class TestRestoreFlow:
    def test_soft_delete_then_restore_incident(self, worker, admin_token):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": f"TEST_restore_{uuid.uuid4().hex[:6]}", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        # soft delete
        r = requests.delete(f"{API}/incidents/{iid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        # not in list
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        assert not any(x["id"] == iid for x in r.json())
        # appears in admin/deleted
        r = requests.get(f"{API}/admin/deleted", headers=admin_token["h"], timeout=15)
        assert any(e["id"] == iid for e in r.json())
        # restore
        r = requests.post(f"{API}/admin/restore", headers=admin_token["h"],
                         json={"collection": "incidents", "id": iid}, timeout=15)
        assert r.status_code == 200 and r.json()["ok"], r.text
        # reappears in normal list
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        assert any(x["id"] == iid for x in r.json()), "restored incident missing from list"

    def test_restore_unknown_collection_404(self, admin_token):
        r = requests.post(f"{API}/admin/restore", headers=admin_token["h"],
                         json={"collection": "bogus", "id": "x"}, timeout=15)
        assert r.status_code == 404, r.text


# --------------------------------------------------------------------------
# Dashboard regression (equipment fields)
# --------------------------------------------------------------------------
class TestDashboardRegression:
    def test_dashboard_has_equipment_fields(self, officer):
        r = requests.get(f"{API}/dashboard", headers=officer["h"], timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "equipment_count" in data and isinstance(data["equipment_count"], int)
        assert "equipment_hazard" in data and isinstance(data["equipment_hazard"], int)
