"""Tests for new auth endpoints:
- POST /api/auth/change-password
- POST /api/auth/delete-account

All tests use throwaway users so the shared seeded accounts stay intact.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TIMEOUT = 30


def _register_throwaway(pw: str = "initialpw1"):
    """Register a fresh throwaway worker; returns (email, password, token)."""
    email = f"tp_{uuid.uuid4().hex[:12]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": "Throwaway", "role": "Worker",
    }, timeout=TIMEOUT)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return email, pw, data["token"]


# ---------------- CHANGE PASSWORD ----------------
class TestChangePassword:

    def test_change_password_success_then_login_flow(self):
        email, old_pw, token = _register_throwaway("oldpassw1")
        new_pw = "newpassw1"

        # Change password
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"current_password": old_pw, "new_password": new_pw},
                          timeout=TIMEOUT)
        assert r.status_code == 200, f"change-password: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

        # Login with NEW password → 200
        r_new = requests.post(f"{API}/auth/login", json={"email": email, "password": new_pw}, timeout=TIMEOUT)
        assert r_new.status_code == 200, f"login new pw: {r_new.status_code} {r_new.text}"
        assert "token" in r_new.json()

        # Login with OLD password → 401
        r_old = requests.post(f"{API}/auth/login", json={"email": email, "password": old_pw}, timeout=TIMEOUT)
        assert r_old.status_code == 401, f"expected 401 for old pw, got {r_old.status_code}: {r_old.text}"

    def test_change_password_wrong_current_returns_401(self):
        email, old_pw, token = _register_throwaway("origpwd12")
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"current_password": "wrongwrong", "new_password": "brandnewpw1"},
                          timeout=TIMEOUT)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

        # Confirm original password still works
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": old_pw}, timeout=TIMEOUT)
        assert r2.status_code == 200

    def test_change_password_short_new_returns_422(self):
        _, _, token = _register_throwaway("origpwd12")
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"current_password": "origpwd12", "new_password": "abc"},
                          timeout=TIMEOUT)
        assert r.status_code == 422, f"expected 422 for short pw, got {r.status_code}: {r.text}"

    def test_change_password_no_auth_returns_401(self):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "whatever", "new_password": "brandnewpw1"},
                          timeout=TIMEOUT)
        assert r.status_code == 401, f"expected 401 no-auth, got {r.status_code}: {r.text}"


# ---------------- DELETE ACCOUNT ----------------
class TestDeleteAccount:

    def test_delete_account_wrong_password_returns_401_and_account_still_usable(self):
        email, pw, token = _register_throwaway("deletepw1")

        r = requests.post(f"{API}/auth/delete-account",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"password": "wrongpassword"},
                          timeout=TIMEOUT)
        assert r.status_code == 401, f"expected 401 wrong pw, got {r.status_code}: {r.text}"

        # Account still usable — /auth/me works
        r_me = requests.get(f"{API}/auth/me",
                            headers={"Authorization": f"Bearer {token}"},
                            timeout=TIMEOUT)
        assert r_me.status_code == 200
        # Login still works
        r_login = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=TIMEOUT)
        assert r_login.status_code == 200

    def test_delete_account_success_then_token_and_login_blocked_and_email_reusable(self):
        email, pw, token = _register_throwaway("deletepw1")

        # Delete
        r = requests.post(f"{API}/auth/delete-account",
                          headers={"Authorization": f"Bearer {token}"},
                          json={"password": pw},
                          timeout=TIMEOUT)
        assert r.status_code == 200, f"delete-account: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

        # (a) Old token rejected on /auth/me
        r_me = requests.get(f"{API}/auth/me",
                            headers={"Authorization": f"Bearer {token}"},
                            timeout=TIMEOUT)
        assert r_me.status_code == 401, f"expected 401 after deletion on /auth/me, got {r_me.status_code}: {r_me.text}"

        # (b) Login with same email+pw → 401 or 403 (email was scrambled so 401 is expected)
        r_login = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=TIMEOUT)
        assert r_login.status_code in (401, 403), \
            f"expected 401/403 after deletion login, got {r_login.status_code}: {r_login.text}"

        # (c) Email can be re-registered fresh
        r_reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "brandnewpw1", "name": "Re-Reg", "role": "Worker",
        }, timeout=TIMEOUT)
        assert r_reg.status_code == 200, f"re-register after delete failed: {r_reg.status_code} {r_reg.text}"
        assert "token" in r_reg.json()

    def test_delete_account_no_auth_returns_401(self):
        r = requests.post(f"{API}/auth/delete-account",
                          json={"password": "irrelevant"},
                          timeout=TIMEOUT)
        assert r.status_code == 401, f"expected 401 no-auth, got {r.status_code}: {r.text}"


# ---------------- REGRESSION: SHARED ACCOUNTS UNTOUCHED ----------------
class TestSharedAccountsIntact:
    """Verify the three shared accounts still login with their known passwords."""

    @pytest.mark.parametrize("email,pw", [
        ("safety@tk.com", "test1234"),
        ("worker@tk.com", "test1234"),
        ("halfbc175@gmail.com", "owner1234"),
    ])
    def test_shared_login_ok(self, email, pw):
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=TIMEOUT)
        assert r.status_code == 200, f"shared login broken for {email}: {r.status_code} {r.text}"
