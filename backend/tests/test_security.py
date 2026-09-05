"""Security-focused tests for TK SafetyGuard.

Covers the audit fixes:
  SEC-001  Registration role gating (privileged roles need OFFICER_ACCESS_CODE)
  SEC-002a LOTO release authorisation
  SEC-002b Incident status authorisation
  SEC-003  File access control + path traversal
  Assessment visibility (worker vs privileged) + approval gate
  Regression of core flows + AI assess -> file GET
"""
import os
import io
import uuid
import base64
import time

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
    """Login or register."""
    tok, user = _login(email, password)
    if tok:
        return tok, user
    r = _register(email, password, name, role, access_code)
    assert r.status_code == 200, f"seed register {email} failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="session")
def officer():
    tok, user = _ensure(OFFICER_EMAIL, OFFICER_PW, "Safety Officer", "Safety Officer", ACCESS_CODE)
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def worker():
    tok, user = _ensure(WORKER_EMAIL, WORKER_PW, "Worker", "Worker")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def worker2():
    """A second throwaway worker for cross-user tests."""
    email = f"TEST_worker2_{uuid.uuid4().hex[:6]}@tk.com"
    tok, user = _ensure(email, "test1234", "Test Worker 2", "Worker")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def realistic_jpeg_b64():
    from PIL import Image, ImageDraw
    W, H = 400, 300
    img = Image.new("RGB", (W, H), (200, 200, 195))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 60], fill=(150, 150, 160))
    for x in range(0, W, 60):
        d.line([(x, 0), (x, 60)], fill=(40, 40, 40), width=3)
    d.rectangle([40, 80, 160, 260], fill=(90, 90, 110))
    d.rectangle([200, 120, 360, 240], fill=(230, 190, 30), outline=(0, 0, 0), width=3)
    d.ellipse([250, 200, 280, 230], fill=(20, 20, 20))
    d.ellipse([320, 200, 350, 230], fill=(20, 20, 20))
    d.rectangle([180, 250, 380, 260], fill=(220, 200, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


# --------------------------------------------------------------------------
# SEC-001 Registration role gating
# --------------------------------------------------------------------------
class TestSEC001Registration:
    def test_worker_registers_no_code(self):
        email = f"TEST_worker_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Worker", "Worker")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Worker"

    def test_contractor_registers_no_code(self):
        email = f"TEST_contractor_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Contractor", "Contractor")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Contractor"

    def test_safety_officer_without_code_forbidden(self):
        email = f"TEST_officer_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Officer", "Safety Officer")
        assert r.status_code == 403, r.text

    def test_supervisor_without_code_forbidden(self):
        email = f"TEST_sup_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Sup", "Supervisor")
        assert r.status_code == 403, r.text

    def test_safety_officer_with_code_succeeds(self):
        email = f"TEST_officer_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Officer", "Safety Officer", ACCESS_CODE)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Safety Officer"

    def test_supervisor_with_code_succeeds(self):
        email = f"TEST_sup_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Sup", "Supervisor", ACCESS_CODE)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Supervisor"

    def test_invalid_role_falls_back_to_worker(self):
        email = f"TEST_bogus_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Bogus", "Admin")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "Worker"

    def test_wrong_access_code_is_forbidden(self):
        email = f"TEST_officer_wrong_{uuid.uuid4().hex[:6]}@tk.com"
        r = _register(email, "test1234", "TEST Officer", "Safety Officer", "WRONG-CODE")
        assert r.status_code == 403, r.text


# --------------------------------------------------------------------------
# SEC-002a LOTO release authorisation
# --------------------------------------------------------------------------
class TestSEC002aLoto:
    def test_owner_can_release_own(self, worker):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_M_{uuid.uuid4().hex[:6]}", "machine_name": "TEST Press",
            "location": "TEST", "reason": "TEST", "lock_number": "L-1"}, timeout=15)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        r = requests.patch(f"{API}/loto/{lid}", headers=worker["h"],
                           json={"status": "released"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "released"

    def test_other_worker_forbidden(self, worker, worker2):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_M_{uuid.uuid4().hex[:6]}", "machine_name": "TEST Saw",
            "location": "TEST", "reason": "TEST", "lock_number": "L-2"}, timeout=15)
        assert r.status_code == 200
        lid = r.json()["id"]
        r = requests.patch(f"{API}/loto/{lid}", headers=worker2["h"],
                           json={"status": "released"}, timeout=15)
        assert r.status_code == 403, r.text
        # State unchanged
        r = requests.get(f"{API}/loto", headers=worker["h"], timeout=15)
        row = next(x for x in r.json() if x["id"] == lid)
        assert row["status"] == "locked"

    def test_safety_officer_can_release_any(self, worker, officer):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_M_{uuid.uuid4().hex[:6]}", "machine_name": "TEST Grinder",
            "location": "TEST", "reason": "TEST", "lock_number": "L-3"}, timeout=15)
        lid = r.json()["id"]
        r = requests.patch(f"{API}/loto/{lid}", headers=officer["h"],
                           json={"status": "released"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "released"

    def test_invalid_status_422(self, worker):
        r = requests.post(f"{API}/loto", headers=worker["h"], json={
            "machine_id": f"TEST_M_{uuid.uuid4().hex[:6]}", "machine_name": "TEST",
            "location": "TEST", "reason": "TEST", "lock_number": "L-4"}, timeout=15)
        lid = r.json()["id"]
        r = requests.patch(f"{API}/loto/{lid}", headers=worker["h"],
                           json={"status": "hacked"}, timeout=15)
        assert r.status_code == 422, r.text


# --------------------------------------------------------------------------
# SEC-002b Incident status authorisation
# --------------------------------------------------------------------------
class TestSEC002bIncidents:
    def test_non_owner_forbidden(self, worker, worker2):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_incident_403", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        assert r.status_code == 200
        iid = r.json()["id"]
        r = requests.patch(f"{API}/incidents/{iid}?status=closed",
                           headers=worker2["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_owner_can_close(self, worker):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_incident_own", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        r = requests.patch(f"{API}/incidents/{iid}?status=closed",
                           headers=worker["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "closed"

    def test_officer_can_close_any(self, worker, officer):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_incident_officer", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        r = requests.patch(f"{API}/incidents/{iid}?status=closed",
                           headers=officer["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "closed"

    def test_invalid_status_422(self, worker):
        r = requests.post(f"{API}/incidents", headers=worker["h"], json={
            "title": "TEST_bad_status", "category": "Near Miss",
            "severity": "Low", "location": "TEST", "description": "TEST"}, timeout=15)
        iid = r.json()["id"]
        r = requests.patch(f"{API}/incidents/{iid}?status=hacked",
                           headers=worker["h"], timeout=15)
        assert r.status_code == 422, r.text

    def test_missing_incident_404(self, worker):
        r = requests.patch(f"{API}/incidents/does-not-exist-{uuid.uuid4().hex}?status=closed",
                           headers=worker["h"], timeout=15)
        assert r.status_code == 404, r.text


# --------------------------------------------------------------------------
# Assessment visibility & sign-off
# --------------------------------------------------------------------------
class TestAssessmentVisibility:
    """Uses the AI endpoint to seed one worker-owned + one worker2-owned assessment."""

    @pytest.fixture(scope="class")
    def worker_assessment(self, worker, realistic_jpeg_b64):
        r = requests.post(f"{API}/ai/assess", headers=worker["h"], json={
            "mode": "risk", "image_base64": realistic_jpeg_b64,
            "title": "TEST_worker_risk", "location": "TEST", "notes": "TEST"}, timeout=180)
        assert r.status_code == 200, r.text
        return r.json()

    def test_worker_sees_own_only(self, worker, worker2, worker_assessment):
        # worker2 creates one too
        r = requests.post(f"{API}/ai/assess", headers=worker2["h"], json={
            "mode": "risk", "image_base64": None,
            "title": "TEST_worker2_risk", "location": "TEST", "notes": "TEST"}, timeout=180)
        assert r.status_code == 200
        other_id = r.json()["id"]

        r = requests.get(f"{API}/assessments", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert worker_assessment["id"] in ids
        assert other_id not in ids, "Worker leaked another user's assessment"

        # And direct GET of other → 404
        r = requests.get(f"{API}/assessments/{other_id}", headers=worker["h"], timeout=15)
        assert r.status_code == 404, r.text

    def test_officer_sees_all(self, officer, worker_assessment):
        r = requests.get(f"{API}/assessments", headers=officer["h"], timeout=15)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert worker_assessment["id"] in ids
        # Direct GET
        r = requests.get(f"{API}/assessments/{worker_assessment['id']}",
                         headers=officer["h"], timeout=15)
        assert r.status_code == 200

    def test_worker_cannot_approve(self, worker, worker_assessment):
        r = requests.patch(f"{API}/assessments/{worker_assessment['id']}/approve",
                           headers=worker["h"], timeout=15)
        assert r.status_code == 403, r.text

    def test_officer_can_approve(self, officer, worker_assessment):
        r = requests.patch(f"{API}/assessments/{worker_assessment['id']}/approve",
                           headers=officer["h"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"
        assert r.json()["approved_by_role"] == "Safety Officer"


# --------------------------------------------------------------------------
# SEC-003 File access control + traversal
# --------------------------------------------------------------------------
class TestSEC003Files:
    @pytest.fixture(scope="class")
    def worker_file_path(self, worker, realistic_jpeg_b64):
        r = requests.post(f"{API}/ai/assess", headers=worker["h"], json={
            "mode": "risk", "image_base64": realistic_jpeg_b64,
            "title": "TEST_file_owner", "location": "TEST", "notes": "TEST"}, timeout=180)
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("photo_path"), f"expected photo_path, got {doc}"
        return doc["photo_path"]

    def test_owner_can_read(self, worker, worker_file_path):
        r = requests.get(f"{API}/files/{worker_file_path}", headers=worker["h"], timeout=30)
        assert r.status_code == 200, r.text
        assert r.content and len(r.content) > 100

    def test_other_worker_forbidden(self, worker2, worker_file_path):
        r = requests.get(f"{API}/files/{worker_file_path}", headers=worker2["h"], timeout=30)
        assert r.status_code == 403, r.text

    def test_officer_can_read(self, officer, worker_file_path):
        r = requests.get(f"{API}/files/{worker_file_path}", headers=officer["h"], timeout=30)
        assert r.status_code == 200, r.text

    def test_traversal_dotdot_rejected(self, worker):
        # requests won't append ..; use raw URL
        url = f"{API}/files/tk-safetyguard/../etc/passwd"
        r = requests.get(url, headers=worker["h"], timeout=15)
        assert r.status_code == 400, r.text

    def test_non_app_prefix_rejected(self, worker):
        r = requests.get(f"{API}/files/other-app/uploads/1.jpg", headers=worker["h"], timeout=15)
        assert r.status_code == 400, r.text

    def test_missing_auth_401(self, worker_file_path):
        r = requests.get(f"{API}/files/{worker_file_path}", timeout=15)
        assert r.status_code == 401, r.text


# --------------------------------------------------------------------------
# Regression - core flows
# --------------------------------------------------------------------------
class TestRegression:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200

    def test_login_me(self, worker):
        r = requests.get(f"{API}/auth/me", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == WORKER_EMAIL

    def test_dashboard(self, officer):
        r = requests.get(f"{API}/dashboard", headers=officer["h"], timeout=20)
        assert r.status_code == 200
        for k in ("open_incidents", "active_locks", "assessments_count",
                  "traffic_zones", "on_site", "recent_assessments"):
            assert k in r.json()

    def test_traffic_flow(self, worker):
        r = requests.post(f"{API}/traffic", headers=worker["h"], json={
            "zone_name": f"TEST_zone_{uuid.uuid4().hex[:6]}", "zone_type": "pedestrian",
            "risk_note": "TEST", "controls": "TEST"}, timeout=15)
        assert r.status_code == 200
        zid = r.json()["id"]
        r = requests.get(f"{API}/traffic", headers=worker["h"], timeout=15)
        assert any(z["id"] == zid for z in r.json())

    def test_access_signin_signout(self, worker):
        r = requests.post(f"{API}/access", headers=worker["h"],
                          json={"type": "signin"}, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/access", headers=worker["h"], timeout=15)
        assert r.status_code == 200
        assert "on_site" in r.json()
        r = requests.post(f"{API}/access", headers=worker["h"],
                          json={"type": "signout"}, timeout=15)
        assert r.status_code == 200

    def test_visitor_access(self, worker):
        r = requests.post(f"{API}/access", headers=worker["h"], json={
            "type": "visitor", "visitor_name": "TEST_Jane",
            "company": "TEST_Acme", "purpose": "TEST audit"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["visitor_name"] == "TEST_Jane"
