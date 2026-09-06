"""Iter5: verify deployment-config fixes did not regress auth + admin-2FA.

- OFFICER_ACCESS_CODE default removed from source (still set in .env) -> gating unchanged
- EMAIL_FROM_NAME quoted in .env -> admin OTP endpoint still returns 200
- httpx pinned in requirements.txt (used by tests indirectly via server)
"""
import os
import uuid
import asyncio
from pathlib import Path

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://whs-safety-hub.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

OWNER_EMAIL = "halfbc175@gmail.com"
OWNER_PW = "owner1234"
OFFICER_EMAIL = "safety@tk.com"
OFFICER_PW = "test1234"
WORKER_EMAIL = "worker@tk.com"
WORKER_PW = "test1234"
ACCESS_CODE = "TK-SAFETY-2026"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    return r


def _reg(email, pw, name, role, code=""):
    return requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": pw, "name": name, "role": role, "access_code": code},
        timeout=15,
    )


def _me(tok):
    return requests.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=15,
    )


def _get_otp(email):
    async def _q():
        c = AsyncIOMotorClient(MONGO_URL)
        rec = await c[DB_NAME].admin_otps.find_one({"email": email.lower()})
        c.close()
        return rec

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_q())
    finally:
        loop.close()


# ---- Officer access-code gating (unchanged behaviour after .env-only config) ----
class TestOfficerAccessCodeGate:
    def test_officer_without_code_403(self):
        email = f"TEST_iter5_off_{uuid.uuid4().hex[:6]}@tk.com"
        r = _reg(email, "test1234", "TEST Officer", "Safety Officer")
        assert r.status_code == 403, r.text

    def test_officer_with_code_200(self):
        email = f"TEST_iter5_off_ok_{uuid.uuid4().hex[:6]}@tk.com"
        r = _reg(email, "test1234", "TEST Officer", "Safety Officer", ACCESS_CODE)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Safety Officer"

    def test_worker_no_code_200(self):
        email = f"TEST_iter5_w_{uuid.uuid4().hex[:6]}@tk.com"
        r = _reg(email, "test1234", "TEST W", "Worker")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Worker"


# ---- Existing accounts still login + me ----
class TestExistingAccountsAuth:
    @pytest.mark.parametrize(
        "email,pw",
        [(OFFICER_EMAIL, OFFICER_PW), (WORKER_EMAIL, WORKER_PW), (OWNER_EMAIL, OWNER_PW)],
    )
    def test_login_and_me(self, email, pw):
        r = _login(email, pw)
        assert r.status_code == 200, f"{email} login: {r.status_code} {r.text}"
        tok = r.json()["token"]
        r = _me(tok)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"].lower() == email.lower()


# ---- Admin 2FA still functional (EMAIL_FROM_NAME quoted change) ----
class TestAdmin2FA:
    def test_owner_request_and_verify_otp(self):
        r = _login(OWNER_EMAIL, OWNER_PW)
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        r = requests.post(f"{API}/admin/request-otp", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("sent_to", "").lower() == OWNER_EMAIL

        rec = _get_otp(OWNER_EMAIL)
        assert rec and rec.get("code") and len(rec["code"]) == 6

        r = requests.post(
            f"{API}/admin/verify-otp", headers=h, json={"code": rec["code"]}, timeout=15
        )
        assert r.status_code == 200, r.text
        assert "admin_token" in r.json()

    def test_non_owner_request_otp_403(self):
        r = _login(WORKER_EMAIL, WORKER_PW)
        assert r.status_code == 200
        tok = r.json()["token"]
        r = requests.post(
            f"{API}/admin/request-otp",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_officer_non_owner_request_otp_403(self):
        r = _login(OFFICER_EMAIL, OFFICER_PW)
        assert r.status_code == 200
        tok = r.json()["token"]
        r = requests.post(
            f"{API}/admin/request-otp",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r.status_code == 403, r.text
