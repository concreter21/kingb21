"""Tests for forgot-password / reset-password (email OTP) flow.

Requirements:
  - Backend running at EXPO_PUBLIC_BACKEND_URL/api
  - MongoDB reachable via MONGO_URL (to read the 6-digit OTP from db.password_resets)
"""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

OFFICER_CODE = "TK-SAFETY-2026"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(api_client, email, password, role="Worker", access_code=""):
    payload = {"email": email, "password": password, "name": "TEST User", "role": role, "access_code": access_code}
    return api_client.post(f"{API}/auth/register", json=payload, timeout=30)


def _make_email():
    # backend lowercases emails on register/forgot; keep lowercase so mongo lookups match.
    return f"test_reset_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def temp_user(api_client, mongo_db):
    """Register a throw-away worker; delete row + reset row after test."""
    email = _make_email()
    password = "orig-pass-1"
    r = _register(api_client, email, password)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    yield {"email": email, "password": password}
    mongo_db.users.delete_many({"email": email})
    mongo_db.password_resets.delete_many({"email": email})


# ---------------------------------------------------------------------------
# forgot-password
# ---------------------------------------------------------------------------


class TestForgotPassword:
    def test_forgot_password_existing_user_creates_reset_record(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

        rec = mongo_db.password_resets.find_one({"email": email})
        assert rec is not None, "password_resets doc not created"
        assert isinstance(rec.get("code"), str) and len(rec["code"]) == 6 and rec["code"].isdigit()
        exp = datetime.fromisoformat(rec["expires_at"])
        # future expiry
        assert exp > datetime.now(timezone.utc)
        assert rec.get("attempts", 0) == 0

    def test_forgot_password_nonexistent_user_returns_ok_and_no_record(self, api_client, mongo_db):
        email = f"TEST_ghost_{uuid.uuid4().hex[:8]}@nowhere.example"
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        rec = mongo_db.password_resets.find_one({"email": email})
        assert rec is None, f"reset record must not exist for unknown email: {rec}"


# ---------------------------------------------------------------------------
# reset-password happy path + old-password + record deletion
# ---------------------------------------------------------------------------


class TestResetPasswordHappyPath:
    def test_full_reset_flow(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]
        old_pw = temp_user["password"]
        new_pw = "new-pass-9"

        # request code
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200
        code = mongo_db.password_resets.find_one({"email": email})["code"]

        # reset
        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": email, "code": code, "new_password": new_pw}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "user" in body
        assert body["user"]["email"] == email

        # login with new password succeeds
        r = api_client.post(f"{API}/auth/login", json={"email": email, "password": new_pw}, timeout=30)
        assert r.status_code == 200, f"login with new pw failed: {r.text}"

        # login with old password fails
        r = api_client.post(f"{API}/auth/login", json={"email": email, "password": old_pw}, timeout=30)
        assert r.status_code == 401, f"old password should not work anymore: {r.status_code} {r.text}"

        # reset record deleted
        assert mongo_db.password_resets.find_one({"email": email}) is None

        # replaying same code fails (record gone -> 400 "Request a reset code first")
        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": email, "code": code, "new_password": "another-pw"}, timeout=30)
        assert r.status_code in (400, 401), f"expected 400/401, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# validation & attempt lockout
# ---------------------------------------------------------------------------


class TestResetPasswordValidation:
    def test_reset_without_prior_request_returns_400(self, api_client, mongo_db):
        email = _make_email()
        # cleanup any residue
        mongo_db.password_resets.delete_many({"email": email})
        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": email, "code": "123456", "new_password": "abcdef"}, timeout=30)
        assert r.status_code == 400, r.text

    def test_new_password_too_short_returns_422(self, api_client, temp_user):
        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": temp_user["email"], "code": "123456", "new_password": "abc"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_wrong_code_401_and_lockout_after_5(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200
        real_code = mongo_db.password_resets.find_one({"email": email})["code"]
        wrong = "000000" if real_code != "000000" else "111111"

        # 5 wrong attempts -> 401 each; increments attempts
        for i in range(5):
            r = api_client.post(f"{API}/auth/reset-password",
                                json={"email": email, "code": wrong, "new_password": "goodpass1"}, timeout=30)
            assert r.status_code == 401, f"attempt {i+1}: expected 401, got {r.status_code} {r.text}"

        # 6th attempt (even with correct code) -> 429 due to attempts >= 5
        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": email, "code": real_code, "new_password": "goodpass1"}, timeout=30)
        assert r.status_code == 429, f"expected 429 lockout, got {r.status_code} {r.text}"

        rec = mongo_db.password_resets.find_one({"email": email})
        assert rec.get("attempts", 0) >= 5

    def test_expired_code_returns_400(self, api_client, mongo_db, temp_user):
        email = temp_user["email"]
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=30)
        assert r.status_code == 200
        code = mongo_db.password_resets.find_one({"email": email})["code"]
        # force-expire
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        mongo_db.password_resets.update_one({"email": email}, {"$set": {"expires_at": past, "attempts": 0}})

        r = api_client.post(f"{API}/auth/reset-password",
                            json={"email": email, "code": code, "new_password": "goodpass1"}, timeout=30)
        assert r.status_code == 400, f"expected 400 expired, got {r.status_code} {r.text}"


# ---------------------------------------------------------------------------
# regression on existing auth
# ---------------------------------------------------------------------------


class TestAuthRegression:
    def test_worker_register_no_code_ok(self, api_client, mongo_db):
        email = _make_email()
        try:
            r = _register(api_client, email, "abcdef1", role="Worker")
            assert r.status_code == 200, r.text
            assert r.json()["user"]["role"] == "Worker"
        finally:
            mongo_db.users.delete_many({"email": email})

    def test_officer_register_needs_code(self, api_client, mongo_db):
        email = _make_email()
        try:
            # no code -> 403
            r = _register(api_client, email, "abcdef1", role="Safety Officer")
            assert r.status_code == 403, r.text
            # with correct code -> 200
            r = _register(api_client, email, "abcdef1", role="Safety Officer", access_code=OFFICER_CODE)
            assert r.status_code == 200, r.text
            assert r.json()["user"]["role"] == "Safety Officer"
        finally:
            mongo_db.users.delete_many({"email": email})

    def test_seed_accounts_login_and_me(self, api_client):
        for email, pw in [("safety@tk.com", "test1234"),
                          ("worker@tk.com", "test1234"),
                          ("halfbc175@gmail.com", "owner1234")]:
            r = api_client.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
            assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
            tok = r.json()["token"]
            r = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
            assert r.status_code == 200
            assert r.json()["user"]["email"] == email
