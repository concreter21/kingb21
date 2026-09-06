"""Tests for the three fixes applied on top of the password-reset/admin-OTP flow.

Fix 1 (HIGH) admin_request_otp wraps send_email in try/except → 200 even if
             email provider is throttled (no 502) and code still stored in Mongo.
Fix 2        forgot-password uses $setOnInsert for attempts → re-issuing does NOT
             reset the lockout counter (5-attempt lock is not bypassable).
Fix 3        forgot-password has a 60s per-email cooldown → second call within
             the window returns 200 without changing code/last_sent_at.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

OWNER_EMAIL = "halfbc175@gmail.com"
OWNER_PW = "owner1234"
WORKER_EMAIL = "worker@tk.com"
WORKER_PW = "test1234"


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def mongo_db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(api_client, email, password, role="Worker", access_code=""):
    return api_client.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "TEST User",
        "role": role, "access_code": access_code}, timeout=30)


def _login(api_client, email, password):
    return api_client.post(f"{API}/auth/login",
                           json={"email": email, "password": password}, timeout=30)


def _make_email():
    return f"test_reset_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def temp_user(api_client, mongo_db):
    email = _make_email()
    pw = "orig-pass-1"
    r = _register(api_client, email, pw)
    assert r.status_code == 200, r.text
    yield {"email": email, "password": pw}
    mongo_db.users.delete_many({"email": email})
    mongo_db.password_resets.delete_many({"email": email})


# ---------------------------------------------------------------------------
# FIX 2 — lockout not bypassable by re-issuing forgot-password
# ---------------------------------------------------------------------------
class TestLockoutNotBypassable:
    def test_reissue_does_not_reset_attempts(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]

        # 1) initial forgot-password
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200
        rec1 = mongo_db.password_resets.find_one({"email": email})
        assert rec1 and rec1["code"] and len(rec1["code"]) == 6
        assert rec1.get("attempts", 0) == 0
        original_code = rec1["code"]
        original_last_sent = rec1["last_sent_at"]

        # 2) 5 wrong attempts -> 401 each, then attempts=5
        wrong = "000000" if original_code != "000000" else "111111"
        for i in range(5):
            r = api_client.post(f"{API}/auth/reset-password", json={
                "email": email, "code": wrong, "new_password": "goodpass1"}, timeout=30)
            assert r.status_code == 401, f"attempt {i+1}: expected 401, got {r.status_code}"

        rec2 = mongo_db.password_resets.find_one({"email": email})
        assert rec2.get("attempts", 0) >= 5

        # 3) One more wrong -> 429 (locked)
        r = api_client.post(f"{API}/auth/reset-password", json={
            "email": email, "code": wrong, "new_password": "goodpass1"}, timeout=30)
        assert r.status_code == 429, f"expected 429 lockout, got {r.status_code} {r.text}"

        # 4) Re-issue forgot-password for SAME email → 200 (60s cooldown short-circuits)
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200

        # 5) attempts must still be >=5 (NOT reset to 0), and code/last_sent_at unchanged
        rec3 = mongo_db.password_resets.find_one({"email": email})
        assert rec3.get("attempts", 0) >= 5, (
            f"attempts must NOT be reset by re-issue, got {rec3.get('attempts')}"
        )
        assert rec3["code"] == original_code, "code must not change within 60s cooldown"
        assert rec3["last_sent_at"] == original_last_sent, "last_sent_at must not refresh within 60s"

        # 6) Even the (still-valid) real code must be rejected with 429 because attempts>=5
        r = api_client.post(f"{API}/auth/reset-password", json={
            "email": email, "code": original_code, "new_password": "goodpass1"}, timeout=30)
        assert r.status_code == 429, (
            f"lockout must persist across re-issue, got {r.status_code} {r.text}"
        )


# ---------------------------------------------------------------------------
# FIX 3 — 60s per-email cooldown
# ---------------------------------------------------------------------------
class TestForgotPasswordCooldown:
    def test_second_call_within_60s_does_not_refresh(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]

        r1 = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r1.status_code == 200
        rec1 = mongo_db.password_resets.find_one({"email": email})
        assert rec1 and rec1["code"] and rec1["last_sent_at"]

        # Immediately call again — within cooldown
        r2 = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r2.status_code == 200
        assert r2.json() == {"ok": True}

        rec2 = mongo_db.password_resets.find_one({"email": email})
        assert rec2["code"] == rec1["code"], "code must not be regenerated within cooldown"
        assert rec2["last_sent_at"] == rec1["last_sent_at"], "last_sent_at must not refresh"
        assert rec2["expires_at"] == rec1["expires_at"], "expires_at must not slide forward"


# ---------------------------------------------------------------------------
# FIX 1 — Admin OTP resilience (does NOT 502 even if email is throttled)
# ---------------------------------------------------------------------------
class TestAdminOtpResilience:
    def test_owner_request_otp_returns_200_and_persists_code(self, api_client, mongo_db):
        # login as owner
        r = _login(api_client, OWNER_EMAIL, OWNER_PW)
        assert r.status_code == 200, r.text
        owner_tok = r.json()["token"]
        h = {"Authorization": f"Bearer {owner_tok}"}

        # request OTP — must be 200 even if Resend is 429 (fix #1)
        r = api_client.post(f"{API}/admin/request-otp", headers=h, timeout=30)
        assert r.status_code == 200, (
            f"admin/request-otp must NOT 502 on email throttling — got {r.status_code}: {r.text}"
        )
        body = r.json()
        assert body.get("ok") is True
        assert body.get("sent_to", "").lower() == OWNER_EMAIL

        # code must still be stored regardless of email outcome
        rec = mongo_db.admin_otps.find_one({"email": OWNER_EMAIL})
        assert rec is not None, "admin_otps doc must exist"
        code = rec.get("code")
        assert isinstance(code, str) and len(code) == 6 and code.isdigit(), (
            f"stored code must be a 6-digit numeric string, got {code!r}"
        )
        assert rec.get("attempts", 0) == 0
        exp = datetime.fromisoformat(rec["expires_at"])
        assert exp > datetime.now(timezone.utc)

        # verify-otp with the code -> admin_token
        r = api_client.post(f"{API}/admin/verify-otp",
                            json={"code": code}, headers=h, timeout=30)
        assert r.status_code == 200, f"verify-otp failed: {r.status_code} {r.text}"
        admin_tok = r.json().get("admin_token")
        assert admin_tok, "admin_token missing"

        # admin_token works on GET /api/admin/users
        r = api_client.get(f"{API}/admin/users",
                           headers={"Authorization": f"Bearer {admin_tok}"}, timeout=30)
        assert r.status_code == 200, f"admin/users with admin_token failed: {r.status_code} {r.text}"
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        assert all("_id" not in u and "password_hash" not in u for u in users)

    def test_non_owner_request_otp_returns_403(self, api_client):
        r = _login(api_client, WORKER_EMAIL, WORKER_PW)
        assert r.status_code == 200, r.text
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        r = api_client.post(f"{API}/admin/request-otp", headers=h, timeout=30)
        assert r.status_code == 403, f"non-owner must be 403, got {r.status_code}: {r.text}"

    def test_admin_users_rejects_non_admin_token(self, api_client):
        r = _login(api_client, WORKER_EMAIL, WORKER_PW)
        assert r.status_code == 200, r.text
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        r = api_client.get(f"{API}/admin/users", headers=h, timeout=30)
        assert r.status_code in (401, 403), (
            f"user token must not access admin/users, got {r.status_code}"
        )
