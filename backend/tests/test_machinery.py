"""Tests for the new machinery AI assessor + Equipment Register + auto hazard-report.

Verifies:
  - POST /api/ai/assess mode='machinery' returns structured `result.machinery`
    with all required sub-keys and a PASS|HAZARD outcome, plus top-level
    equipment_outcome and hazard_incident_id fields.
  - GET /api/equipment lists the newly logged equipment (worker sees own only,
    Safety Officer sees all).
  - When outcome=='HAZARD' an incident is auto-created with source=='machinery-ai'
    and matching assessment_id (status='open'). When PASS no such incident.
  - Persistence: GET /api/assessments/{id} returns equipment_outcome and
    hazard_incident_id fields.
  - Dashboard exposes equipment_count and equipment_hazard integers.
  - Regression: risk mode still returns valid structured result and
    result.machinery is null (or absent) for non-machinery modes and no
    equipment/incident is created for that assessment.
"""
import os
import io
import uuid
import base64

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OFFICER_EMAIL = "safety@tk.com"
OFFICER_PW = "test1234"
WORKER_EMAIL = "worker@tk.com"
WORKER_PW = "test1234"
ACCESS_CODE = "TK-SAFETY-2026"


# --------------------------------------------------------------------------
# helpers / fixtures
# --------------------------------------------------------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code == 200:
        return r.json()["token"], r.json()["user"]
    return None, None


def _register(email, password, name, role, access_code=""):
    return requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": name, "role": role, "access_code": access_code,
    }, timeout=30)


def _ensure(email, password, name, role, access_code=""):
    tok, user = _login(email, password)
    if tok:
        return tok, user
    r = _register(email, password, name, role, access_code)
    assert r.status_code == 200, f"seed register {email} failed: {r.status_code} {r.text}"
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
def machinery_jpeg_b64():
    """Realistic JPEG resembling an industrial forklift + electrical panel scene."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = 640, 480
    img = Image.new("RGB", (W, H), (200, 200, 195))  # concrete floor
    d = ImageDraw.Draw(img)

    # ceiling
    d.rectangle([0, 0, W, 80], fill=(150, 150, 160))
    for x in range(0, W, 60):
        d.line([(x, 0), (x, 80)], fill=(40, 40, 40), width=3)

    # forklift body (yellow) with black wheels + mast
    d.rectangle([360, 220, 560, 360], fill=(230, 190, 30), outline=(0, 0, 0), width=3)
    d.rectangle([380, 180, 520, 230], fill=(30, 30, 30))  # cab / roof
    d.ellipse([370, 340, 420, 390], fill=(20, 20, 20))    # wheel
    d.ellipse([500, 340, 550, 390], fill=(20, 20, 20))    # wheel
    d.polygon([(340, 220), (300, 120), (315, 120), (355, 220)], fill=(230, 190, 30), outline=(0, 0, 0))
    d.line([(300, 140), (300, 380)], fill=(60, 60, 60), width=4)  # mast
    d.line([(300, 380), (250, 380)], fill=(60, 60, 60), width=6)  # forks
    d.line([(300, 360), (250, 360)], fill=(60, 60, 60), width=6)

    # electrical panel on the wall (grey enclosure with switches + labels)
    d.rectangle([40, 120, 220, 340], fill=(140, 140, 145), outline=(30, 30, 30), width=3)
    d.rectangle([60, 140, 200, 200], fill=(60, 60, 60))
    d.rectangle([70, 150, 90, 190], fill=(220, 40, 40))    # red e-stop
    d.rectangle([110, 150, 130, 190], fill=(40, 200, 40))  # green start
    d.rectangle([150, 150, 170, 190], fill=(240, 200, 40))  # amber
    d.rectangle([60, 220, 200, 320], fill=(90, 90, 100))
    for y in [230, 250, 270, 290, 310]:
        d.line([(70, y), (190, y)], fill=(200, 200, 210), width=2)

    # nameplate / label
    try:
        font = ImageFont.load_default()
        d.text((50, 100), "TOYOTA 8FGCU25", fill=(20, 20, 20), font=font)
        d.text((50, 350), "AS 2359 / AS/NZS 3000", fill=(20, 20, 20), font=font)
        d.text((400, 200), "SN: 8FGCU25-12345", fill=(255, 255, 255), font=font)
    except Exception:
        pass

    # worker in hi-vis
    d.ellipse([260, 260, 290, 290], fill=(255, 210, 170))
    d.rectangle([265, 290, 285, 350], fill=(240, 200, 30))
    d.rectangle([265, 350, 275, 400], fill=(40, 40, 60))
    d.rectangle([275, 350, 285, 400], fill=(40, 40, 60))
    d.ellipse([258, 252, 292, 268], fill=(255, 240, 40))

    # floor markings
    d.line([(0, 420), (W, 420)], fill=(220, 200, 30), width=6)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


# --------------------------------------------------------------------------
# Machinery assess
# --------------------------------------------------------------------------
class TestMachineryAssess:
    """One AI call, many assertions to keep runtime/cost low."""

    @pytest.fixture(scope="class")
    def machinery_result(self, worker, machinery_jpeg_b64):
        r = requests.post(f"{API}/ai/assess", headers=worker["h"], json={
            "mode": "machinery", "image_base64": machinery_jpeg_b64,
            "title": "TEST_machinery_forklift", "location": "TEST Bay 3",
            "notes": "Toyota 8FGCU25 forklift + adjacent electrical panel"}, timeout=180)
        assert r.status_code == 200, r.text
        return r.json()

    def test_response_shape_and_top_level_fields(self, machinery_result):
        doc = machinery_result
        assert doc.get("mode") == "machinery"
        assert "id" in doc
        # top-level linkage fields
        assert "equipment_outcome" in doc, f"missing equipment_outcome: {doc.keys()}"
        assert doc["equipment_outcome"] in ("PASS", "HAZARD"), doc["equipment_outcome"]
        assert "hazard_incident_id" in doc
        if doc["equipment_outcome"] == "PASS":
            assert doc["hazard_incident_id"] is None
        else:
            assert isinstance(doc["hazard_incident_id"], str) and doc["hazard_incident_id"]

    def test_graceful_perplexity_fallback_fields(self, machinery_result):
        """Perplexity key is invalid (401) → manual_sources should be [] and
        manual_verified False, and the assessment should still be HTTP 200 with
        a valid machinery object (already asserted above). No 500."""
        res = machinery_result.get("result") or {}
        assert "manual_sources" in res, f"missing manual_sources: {list(res.keys())}"
        assert isinstance(res["manual_sources"], list), \
            f"manual_sources must be a list, got {type(res['manual_sources'])}"
        # Invalid key → empty list expected
        assert res["manual_sources"] == [], \
            f"expected empty manual_sources given invalid key, got {res['manual_sources']}"
        assert "manual_verified" in res, f"missing manual_verified: {list(res.keys())}"
        assert res["manual_verified"] is False, \
            f"manual_verified must be False on fallback, got {res['manual_verified']}"

    def test_machinery_object_keys(self, machinery_result):
        m = (machinery_result.get("result") or {}).get("machinery")
        assert isinstance(m, dict), f"expected machinery dict, got {type(m)}"
        for k in ("machine_type", "brand", "model", "identifiers",
                  "identification_confidence", "manual_reference",
                  "guarding_status", "isolation_note", "spec_checks",
                  "warranty_insurance_note", "compliance_note", "outcome"):
            assert k in m, f"machinery missing key {k}: {list(m.keys())}"
        assert isinstance(m["spec_checks"], list), "spec_checks must be a list"
        # each spec_check row must have the expected shape (when non-empty)
        for row in m["spec_checks"][:3]:
            assert isinstance(row, dict)
            for rk in ("item", "requirement", "observed", "status", "reference"):
                assert rk in row, f"spec_check row missing {rk}: {row}"
        assert m["outcome"] in ("PASS", "HAZARD"), m["outcome"]

    def test_persistence_get_assessment(self, worker, machinery_result):
        aid = machinery_result["id"]
        r = requests.get(f"{API}/assessments/{aid}", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["mode"] == "machinery"
        assert "equipment_outcome" in doc
        assert doc["equipment_outcome"] == machinery_result["equipment_outcome"]
        assert "hazard_incident_id" in doc
        assert doc["hazard_incident_id"] == machinery_result["hazard_incident_id"]

    def test_equipment_register_worker_sees_own(self, worker, machinery_result):
        r = requests.get(f"{API}/equipment", headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        match = [e for e in items if e.get("assessment_id") == machinery_result["id"]]
        assert match, f"equipment not logged for assessment {machinery_result['id']}"
        e = match[0]
        for k in ("brand", "model", "machine_type", "outcome", "assessment_id"):
            assert k in e, f"equipment row missing {k}: {list(e.keys())}"
        assert e["outcome"] == machinery_result["equipment_outcome"]

    def test_equipment_register_officer_sees_all(self, officer, machinery_result):
        r = requests.get(f"{API}/equipment", headers=officer["h"], timeout=15)
        assert r.status_code == 200
        assert any(e.get("assessment_id") == machinery_result["id"] for e in r.json()), \
            "Safety Officer must see all equipment rows"

    def test_incident_autoraise_matches_outcome(self, worker, machinery_result):
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        related = [i for i in r.json()
                   if i.get("assessment_id") == machinery_result["id"]
                   and i.get("source") == "machinery-ai"]
        if machinery_result["equipment_outcome"] == "HAZARD":
            assert related, "expected auto-created hazard incident for HAZARD outcome"
            inc = related[0]
            assert inc["status"] == "open"
            assert inc["id"] == machinery_result["hazard_incident_id"]
        else:
            assert not related, "PASS outcome must NOT create a hazard incident"

    def test_dashboard_equipment_counts(self, officer, machinery_result):
        r = requests.get(f"{API}/dashboard", headers=officer["h"], timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "equipment_count" in d and isinstance(d["equipment_count"], int)
        assert "equipment_hazard" in d and isinstance(d["equipment_hazard"], int)
        assert d["equipment_count"] >= 1


# --------------------------------------------------------------------------
# Regression: risk mode and non-machinery mode leaves machinery=null
# --------------------------------------------------------------------------
class TestNonMachineryRegression:
    @pytest.fixture(scope="class")
    def risk_result(self, worker, machinery_jpeg_b64):
        r = requests.post(f"{API}/ai/assess", headers=worker["h"], json={
            "mode": "risk", "image_base64": machinery_jpeg_b64,
            "title": "TEST_risk_regression", "location": "TEST", "notes": "TEST"},
            timeout=180)
        assert r.status_code == 200, r.text
        return r.json()

    def test_risk_result_shape(self, risk_result):
        assert risk_result["mode"] == "risk"
        res = risk_result.get("result") or {}
        assert "overall_risk_level" in res
        assert res["overall_risk_level"] in ("Low", "Medium", "High", "Critical")
        assert "hazards" in res and isinstance(res["hazards"], list)
        assert "summary" in res

    def test_risk_machinery_is_null_or_absent(self, risk_result):
        res = risk_result.get("result") or {}
        m = res.get("machinery")
        # machinery may be None or missing for non-machinery modes
        assert m is None or m == {}, f"non-machinery mode leaked machinery obj: {m}"

    def test_risk_does_not_create_equipment_or_incident(self, worker, risk_result):
        aid = risk_result["id"]
        # no equipment row referencing this assessment
        r = requests.get(f"{API}/equipment", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        assert not any(e.get("assessment_id") == aid for e in r.json())
        # no auto-incident referencing this assessment
        r = requests.get(f"{API}/incidents", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        assert not any(i.get("assessment_id") == aid and i.get("source") == "machinery-ai"
                       for i in r.json())

    def test_risk_no_top_level_equipment_fields(self, risk_result):
        # For non-machinery modes we don't set equipment_outcome / hazard_incident_id
        assert risk_result.get("equipment_outcome") in (None, "")
        assert risk_result.get("hazard_incident_id") in (None, "")

    def test_risk_result_has_no_manual_sources(self, risk_result):
        """Non-machinery modes must NOT attach manual_sources/manual_verified."""
        res = risk_result.get("result") or {}
        assert "manual_sources" not in res, \
            f"non-machinery mode leaked manual_sources: {res.get('manual_sources')}"
        assert "manual_verified" not in res, \
            f"non-machinery mode leaked manual_verified: {res.get('manual_verified')}"
