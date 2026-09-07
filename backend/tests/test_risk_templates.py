"""Backend tests for risk-assessment templates feature (iteration 12).

Covers:
- GET /api/risk-templates (list, auth required)
- GET /api/risk-templates/{id} (detail + 404)
- POST /api/ai/assess with template_id (no image) — 1 Gemini call
- REGRESSION POST /api/ai/assess with image_base64 only — 1 Gemini call
- Auth enforcement (401 without Bearer token)
"""
import base64
import os

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OFFICER = {"email": "safety@tk.com", "password": "test1234"}
WORKER = {"email": "worker@tk.com", "password": "test1234"}

# 1x1 transparent PNG for AI regression call
TINY_PNG = base64.b64encode(
    bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
    )
).decode()

EXPECTED_TEMPLATE_IDS = {
    "risk-assessment-form-spinner",
    "sleeving-environment",
    "manual-spinner",
    "sml-tumbler",
    "tumbler",
    "risk-assessment-form-washer",
    "risk-assessment-form-slicer",
    "pro-seal",
}


@pytest.fixture(scope="module")
def officer_token():
    r = requests.post(f"{API}/auth/login", json=OFFICER, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok, "login response missing token"
    return tok


@pytest.fixture(scope="module")
def worker_token():
    r = requests.post(f"{API}/auth/login", json=WORKER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_headers(officer_token):
    return {"Authorization": f"Bearer {officer_token}"}


# -------------------------------- Template listing --------------------------------
class TestRiskTemplatesList:
    def test_requires_auth(self):
        r = requests.get(f"{API}/risk-templates", timeout=15)
        assert r.status_code == 401

    def test_list_returns_8_templates(self, auth_headers):
        r = requests.get(f"{API}/risk-templates", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 8
        ids = {t["id"] for t in data}
        assert ids == EXPECTED_TEMPLATE_IDS

    def test_list_item_shape(self, auth_headers):
        r = requests.get(f"{API}/risk-templates", headers=auth_headers, timeout=15)
        for t in r.json():
            for k in ("id", "name", "department", "machine", "site", "hazard_count"):
                assert k in t, f"missing key {k} in {t}"
            assert isinstance(t["hazard_count"], int)
            assert t["hazard_count"] > 0

    def test_worker_can_read_templates(self, worker_token):
        r = requests.get(f"{API}/risk-templates", headers={"Authorization": f"Bearer {worker_token}"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 8


# -------------------------------- Template detail --------------------------------
class TestRiskTemplateDetail:
    def test_requires_auth(self):
        r = requests.get(f"{API}/risk-templates/risk-assessment-form-slicer", timeout=15)
        assert r.status_code == 401

    def test_get_slicer_template(self, auth_headers):
        r = requests.get(f"{API}/risk-templates/risk-assessment-form-slicer", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        t = r.json()
        assert t["id"] == "risk-assessment-form-slicer"
        assert isinstance(t.get("hazards"), list)
        assert len(t["hazards"]) > 0
        # Slicer should contain amputation/entanglement/electrical categories
        cats = {(h.get("category") or "").lower() for h in t["hazards"]}
        assert any("amputation" in c for c in cats)
        assert any("electrical" in c for c in cats)

    def test_unknown_id_returns_404(self, auth_headers):
        r = requests.get(f"{API}/risk-templates/does-not-exist", headers=auth_headers, timeout=15)
        assert r.status_code == 404


# -------------------------------- AI assess with template --------------------------------
class TestAiAssessTemplate:
    """Only 1 AI call to limit cost."""

    def test_ai_assess_from_slicer_template_no_image(self, auth_headers):
        payload = {"mode": "risk", "template_id": "risk-assessment-form-slicer"}
        r = requests.post(f"{API}/ai/assess", headers=auth_headers, json=payload, timeout=120)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc.get("template_id") == "risk-assessment-form-slicer"
        assert doc.get("template_name")  # e.g. "Slicer (High Care)"
        result = doc.get("result") or {}
        hazards = result.get("hazards") or []
        assert isinstance(hazards, list) and len(hazards) >= 1
        # Ensure risk categories reflect the company template (amputation/electrical/entanglement)
        blob = " ".join(str(h).lower() for h in hazards)
        assert any(term in blob for term in ("amput", "electric", "entangle")), (
            f"Expected slicer-specific hazard vocabulary in result. Got: {blob[:400]}"
        )


# -------------------------------- AI assess regression (image only) --------------------------------
class TestAiAssessRegression:
    """1 AI call max — verify pre-existing image-based risk mode still works with no template_id."""

    def test_ai_assess_image_no_template(self, auth_headers):
        payload = {"mode": "risk", "image_base64": TINY_PNG}
        r = requests.post(f"{API}/ai/assess", headers=auth_headers, json=payload, timeout=120)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc.get("template_id") is None
        result = doc.get("result") or {}
        # structured assessment should still be present
        assert isinstance(result, dict)
        assert "hazards" in result or "summary" in result or "controls" in result


# -------------------------------- Auth guard --------------------------------
class TestAiAssessAuth:
    def test_unauth_returns_401(self):
        r = requests.post(f"{API}/ai/assess", json={"mode": "risk", "template_id": "manual-spinner"}, timeout=15)
        assert r.status_code == 401
