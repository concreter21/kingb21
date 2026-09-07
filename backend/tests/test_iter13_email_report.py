"""
Iteration 13 tests
- New feature: POST /api/assessments/{id}/email
- Regression sweep: auth, dashboard, list assessments, risk-templates, worker cross-user isolation.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SAFETY_EMAIL = "safety@tk.com"
WORKER_EMAIL = "worker@tk.com"
PASSWORD = "test1234"
RECIPIENT = "delivered@resend.dev"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    body = r.json()
    assert "token" in body, "login response must contain 'token' (not access_token)"
    return body["token"]


@pytest.fixture(scope="module")
def safety_token():
    return _login(SAFETY_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def worker_token():
    return _login(WORKER_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def safety_headers(safety_token):
    return {"Authorization": f"Bearer {safety_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def worker_headers(worker_token):
    return {"Authorization": f"Bearer {worker_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def safety_assessment_id(safety_headers):
    """Reuse an existing assessment (do NOT trigger an AI call)."""
    r = requests.get(f"{API}/assessments", headers=safety_headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0, "No existing assessments to reuse — cannot test email"
    return items[0]["id"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TestAuthLogin:
    def test_login_returns_token_field(self):
        r = requests.post(f"{API}/auth/login", json={"email": SAFETY_EMAIL, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert "access_token" not in body
        assert body["user"]["email"] == SAFETY_EMAIL
        assert body["user"]["role"] in ("Safety Officer", "Supervisor")


# ---------------------------------------------------------------------------
# Email endpoint
# ---------------------------------------------------------------------------
class TestEmailAssessment:
    def test_email_without_auth_401(self, safety_assessment_id):
        r = requests.post(f"{API}/assessments/{safety_assessment_id}/email",
                          json={"recipient": RECIPIENT}, timeout=30)
        assert r.status_code == 401

    def test_email_invalid_address_422(self, safety_assessment_id, safety_headers):
        r = requests.post(f"{API}/assessments/{safety_assessment_id}/email",
                          headers=safety_headers, json={"recipient": "not-an-email"}, timeout=30)
        assert r.status_code == 422

    def test_email_unknown_assessment_404(self, safety_headers):
        r = requests.post(f"{API}/assessments/00000000-0000-0000-0000-000000000000/email",
                          headers=safety_headers, json={"recipient": RECIPIENT}, timeout=30)
        assert r.status_code == 404

    def test_email_success_returns_ok_and_id(self, safety_assessment_id, safety_headers):
        r = requests.post(f"{API}/assessments/{safety_assessment_id}/email",
                          headers=safety_headers, json={"recipient": RECIPIENT}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "email_id" in body
        assert body.get("recipient") == RECIPIENT

    def test_worker_cannot_email_safety_officers_assessment(self, safety_assessment_id, worker_headers):
        """The safety-officer-owned assessment must be 404 for a Worker (not-in-scope, not 403)."""
        r = requests.post(f"{API}/assessments/{safety_assessment_id}/email",
                          headers=worker_headers, json={"recipient": RECIPIENT}, timeout=30)
        assert r.status_code == 404, f"expected 404 for worker cross-user, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Regression: assessments CRUD
# ---------------------------------------------------------------------------
class TestAssessmentsRegression:
    def test_list_assessments(self, safety_headers):
        r = requests.get(f"{API}/assessments", headers=safety_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_assessment(self, safety_headers, safety_assessment_id):
        r = requests.get(f"{API}/assessments/{safety_assessment_id}", headers=safety_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == safety_assessment_id
        assert "mode" in body and "result" in body

    def test_get_unknown_assessment_404(self, safety_headers):
        r = requests.get(f"{API}/assessments/deadbeef-does-not-exist", headers=safety_headers, timeout=30)
        assert r.status_code == 404

    def test_approve_requires_privileged_role(self, worker_headers, safety_assessment_id):
        r = requests.patch(f"{API}/assessments/{safety_assessment_id}/approve",
                           headers=worker_headers, timeout=30)
        # Worker sees 404 (not their record) — either 403 or 404 is acceptable as it enforces isolation.
        assert r.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Regression: risk templates
# ---------------------------------------------------------------------------
class TestRiskTemplatesRegression:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/risk-templates", timeout=30)
        assert r.status_code == 401

    def test_list_returns_seeded_templates(self, safety_headers):
        r = requests.get(f"{API}/risk-templates", headers=safety_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        for t in items:
            for key in ("id", "name", "hazard_count"):
                assert key in t

    def test_get_template_detail(self, safety_headers):
        r = requests.get(f"{API}/risk-templates", headers=safety_headers, timeout=30)
        tid = r.json()[0]["id"]
        r2 = requests.get(f"{API}/risk-templates/{tid}", headers=safety_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("id") == tid
        assert isinstance(r2.json().get("hazards"), list)

    def test_get_unknown_template_404(self, safety_headers):
        r = requests.get(f"{API}/risk-templates/nope-nope", headers=safety_headers, timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Regression: dashboard
# ---------------------------------------------------------------------------
class TestDashboardRegression:
    def test_dashboard_shape(self, safety_headers):
        r = requests.get(f"{API}/dashboard", headers=safety_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        for key in ("open_incidents", "active_locks", "assessments_count",
                    "traffic_zones", "equipment_count", "on_site", "recent_assessments"):
            assert key in body, f"missing dashboard key {key}"
        assert isinstance(body["recent_assessments"], list)

    def test_dashboard_requires_auth(self):
        r = requests.get(f"{API}/dashboard", timeout=30)
        assert r.status_code == 401
