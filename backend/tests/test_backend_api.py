"""Backend tests for TK SafetyGuard.
Covers: auth, dashboard, loto, site access, traffic, incidents, and AI assessments.
Uses external EXPO_PUBLIC_BACKEND_URL (kubernetes-routed /api).
"""
import time
import uuid
import requests


# --- Auth module ---------------------------------------------------------
class TestAuth:
    def test_health_root(self, api_url):
        r = requests.get(f"{api_url}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_register_duplicate_or_login(self, api_client, api_url):
        # Idempotent register - should either succeed or 409
        r = api_client.post(f"{api_url}/auth/register", json={
            "email": "safety@tk.com", "password": "test1234", "name": "Safety Officer", "role": "Safety Officer"
        }, timeout=30)
        assert r.status_code in (200, 409), r.text

    def test_login_success(self, api_client, api_url):
        r = api_client.post(f"{api_url}/auth/login",
                            json={"email": "safety@tk.com", "password": "test1234"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["email"] == "safety@tk.com"

    def test_login_wrong_password(self, api_client, api_url):
        r = api_client.post(f"{api_url}/auth/login",
                            json={"email": "safety@tk.com", "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self, api_url):
        r = requests.get(f"{api_url}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, api_url, auth_headers):
        r = requests.get(f"{api_url}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "safety@tk.com"


# --- Auth protection on other endpoints ---------------------------------
class TestAuthProtection:
    def test_dashboard_401(self, api_url):
        assert requests.get(f"{api_url}/dashboard", timeout=15).status_code == 401

    def test_loto_401(self, api_url):
        assert requests.get(f"{api_url}/loto", timeout=15).status_code == 401

    def test_access_401(self, api_url):
        assert requests.get(f"{api_url}/access", timeout=15).status_code == 401

    def test_traffic_401(self, api_url):
        assert requests.get(f"{api_url}/traffic", timeout=15).status_code == 401

    def test_incidents_401(self, api_url):
        assert requests.get(f"{api_url}/incidents", timeout=15).status_code == 401

    def test_assessments_401(self, api_url):
        assert requests.get(f"{api_url}/assessments", timeout=15).status_code == 401


# --- Dashboard ----------------------------------------------------------
class TestDashboard:
    def test_dashboard_shape(self, api_url, auth_headers):
        r = requests.get(f"{api_url}/dashboard", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["open_incidents", "active_locks", "on_site", "assessments_count",
                  "traffic_zones", "recent_assessments"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["open_incidents"], int)
        assert isinstance(d["active_locks"], int)
        assert isinstance(d["recent_assessments"], list)


# --- LOTO ---------------------------------------------------------------
class TestLoto:
    def test_create_list_release(self, api_url, auth_headers):
        machine_id = f"TEST_MACH_{uuid.uuid4().hex[:6]}"
        payload = {"machine_id": machine_id, "machine_name": "TEST_Mixer 3000",
                   "location": "TEST_Line A", "reason": "TEST maintenance", "lock_number": "L-999"}
        r = requests.post(f"{api_url}/loto", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "locked"
        assert doc["machine_id"] == machine_id
        lid = doc["id"]

        # list contains it
        r = requests.get(f"{api_url}/loto", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == lid for x in r.json())

        # release
        r = requests.patch(f"{api_url}/loto/{lid}", headers=auth_headers,
                           json={"status": "released"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "released"
        assert r.json()["released_at"] is not None

    def test_loto_release_not_found(self, api_url, auth_headers):
        r = requests.patch(f"{api_url}/loto/does-not-exist", headers=auth_headers,
                           json={"status": "released"}, timeout=15)
        assert r.status_code == 404


# --- Site Access --------------------------------------------------------
class TestAccess:
    def test_signin_signout_flow(self, api_url, auth_headers):
        r = requests.post(f"{api_url}/access", headers=auth_headers,
                          json={"type": "signin"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["type"] == "signin"

        r = requests.get(f"{api_url}/access", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "in"
        assert data["on_site"] >= 1
        assert isinstance(data["records"], list)

        r = requests.post(f"{api_url}/access", headers=auth_headers,
                          json={"type": "signout"}, timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{api_url}/access", headers=auth_headers, timeout=15)
        assert r.json()["status"] == "out"

    def test_visitor(self, api_url, auth_headers):
        r = requests.post(f"{api_url}/access", headers=auth_headers, json={
            "type": "visitor", "visitor_name": "TEST_Jane Visitor",
            "company": "TEST_Acme", "purpose": "TEST_audit"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["visitor_name"] == "TEST_Jane Visitor"


# --- Traffic zones ------------------------------------------------------
class TestTraffic:
    def test_create_and_list(self, api_url, auth_headers):
        payload = {"zone_name": f"TEST_Zone_{uuid.uuid4().hex[:6]}",
                   "zone_type": "forklift", "risk_note": "TEST pinch point",
                   "controls": "TEST separation"}
        r = requests.post(f"{api_url}/traffic", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        zid = r.json()["id"]
        r = requests.get(f"{api_url}/traffic", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert any(z["id"] == zid for z in r.json())


# --- Incidents ----------------------------------------------------------
class TestIncidents:
    def test_create_list_close(self, api_url, auth_headers):
        payload = {"title": "TEST_Near miss forklift", "category": "Near Miss",
                   "severity": "Medium", "location": "TEST_Aisle 3",
                   "description": "TEST forklift close to pedestrian"}
        r = requests.post(f"{api_url}/incidents", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        assert r.json()["status"] == "open"

        r = requests.get(f"{api_url}/incidents", headers=auth_headers, timeout=15)
        assert any(i["id"] == iid for i in r.json())

        r = requests.patch(f"{api_url}/incidents/{iid}?status=closed",
                           headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "closed"


# --- AI Assess (slow, 30-90s) ------------------------------------------
class TestAI:
    def test_ai_machinery_assess(self, api_url, auth_headers, warehouse_image_b64):
        payload = {"mode": "machinery", "image_base64": warehouse_image_b64,
                   "title": "TEST_Machinery check",
                   "location": "TEST_Arndell Park", "notes": "TEST forklift and rack"}
        r = requests.post(f"{api_url}/ai/assess", headers=auth_headers, json=payload, timeout=180)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["mode"] == "machinery"
        assert "result" in doc
        res = doc["result"]
        assert "overall_risk_level" in res
        assert res["overall_risk_level"] in ["Low", "Medium", "High", "Critical"]
        assert "hazards" in res and isinstance(res["hazards"], list)
        assert "summary" in res
        # photo_path may be None if storage fails, but should be present as a key
        assert "photo_path" in doc

        # verify persistence via GET
        aid = doc["id"]
        r = requests.get(f"{api_url}/assessments/{aid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == aid

    def test_list_assessments(self, api_url, auth_headers):
        r = requests.get(f"{api_url}/assessments", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
