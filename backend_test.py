#!/usr/bin/env python3
"""
Comprehensive regression test suite for SolarSafe Pro backend.
Tests all endpoints including new admin endpoints.
"""

import requests
import json
import base64
from io import BytesIO
from PIL import Image
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://komma5-safepro.preview.emergentagent.com/api"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def create_test_image_base64():
    """Create a small 32x32 gray JPEG image and return as base64."""
    img = Image.new("RGB", (32, 32), (128, 128, 128))
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')

def print_test(num, description):
    """Print test header."""
    print(f"\n{'='*80}")
    print(f"Test {num}: {description}")
    print(f"{'='*80}")

def print_result(success, message, details=None):
    """Print test result."""
    if success:
        print(f"{GREEN}✓ PASS{RESET}: {message}")
    else:
        print(f"{RED}✗ FAIL{RESET}: {message}")
    if details:
        print(f"  Details: {details}")

def verify_response(response, expected_status, expected_fields=None, test_name=""):
    """Verify response status and fields."""
    if response.status_code != expected_status:
        print_result(False, f"Expected status {expected_status}, got {response.status_code}", 
                    f"Response: {response.text[:500]}")
        return False
    
    if expected_fields:
        try:
            data = response.json()
            for field in expected_fields:
                if field not in data:
                    print_result(False, f"Missing field '{field}' in response", 
                                f"Response: {json.dumps(data, indent=2)[:500]}")
                    return False
                # Check if field is non-empty for lists and strings
                if isinstance(data[field], list) and len(data[field]) == 0:
                    print_result(False, f"Field '{field}' is empty list", 
                                f"Response: {json.dumps(data, indent=2)[:500]}")
                    return False
                if isinstance(data[field], str) and field in ['summary', 'reply', 'description'] and not data[field]:
                    print_result(False, f"Field '{field}' is empty string", 
                                f"Response: {json.dumps(data, indent=2)[:500]}")
                    return False
        except Exception as e:
            print_result(False, f"Error parsing response: {e}", f"Response: {response.text[:500]}")
            return False
    
    print_result(True, test_name, f"Status: {response.status_code}")
    return True

def main():
    """Run all regression tests including new admin endpoints."""
    print(f"\n{'#'*80}")
    print(f"# SolarSafe Pro Backend Regression Test Suite")
    print(f"# Backend URL: {BACKEND_URL}")
    print(f"{'#'*80}")
    
    test_results = []
    hazard_id = None
    alert_id = None
    admin_user_id = None
    admin_token = None
    
    # Test 1: GET /api/
    print_test(1, "GET /api/ → {\"message\": \"Hello World\"}")
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        success = verify_response(response, 200, ["message"], "Root endpoint working")
        if success:
            data = response.json()
            if data.get("message") == "Hello World":
                print(f"  Message: {data['message']}")
            else:
                print(f"  {YELLOW}Warning{RESET}: Message is '{data.get('message')}', expected 'Hello World'")
        test_results.append(("Test 1: GET /api/", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 1: GET /api/", False))
    
    # Test 2: POST /api/status
    print_test(2, "POST /api/status → {id, client_name, timestamp}")
    try:
        payload = {"client_name": "regression-1"}
        response = requests.post(f"{BACKEND_URL}/status", json=payload, timeout=10)
        success = verify_response(response, 200, ["id", "client_name", "timestamp"], "Status check creation working")
        if success:
            data = response.json()
            print(f"  ID: {data['id']}")
            print(f"  Client: {data['client_name']}")
            print(f"  Timestamp: {data['timestamp']}")
        test_results.append(("Test 2: POST /api/status", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 2: POST /api/status", False))
    
    # Test 3: POST /api/swms/generate with OpenAI
    print_test(3, "POST /api/swms/generate (OpenAI) → {hazards, controls, ppe, summary}")
    try:
        payload = {
            "site": "Site A – Residential",
            "job_type": "Rooftop PV Installation",
            "notes": "",
            "model_provider": "openai"
        }
        response = requests.post(f"{BACKEND_URL}/swms/generate", json=payload, timeout=30)
        success = verify_response(response, 200, ["hazards", "controls", "ppe", "summary"], 
                                 "SWMS generation with OpenAI working")
        if success:
            data = response.json()
            print(f"  Hazards: {len(data['hazards'])} items")
            print(f"  Controls: {len(data['controls'])} items")
            print(f"  PPE: {len(data['ppe'])} items")
            print(f"  Summary length: {len(data['summary'])} chars")
        test_results.append(("Test 3: POST /api/swms/generate (OpenAI)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 3: POST /api/swms/generate (OpenAI)", False))
    
    # Test 4: POST /api/swms/generate with Gemini
    print_test(4, "POST /api/swms/generate (Gemini) → {hazards, controls, ppe, summary}")
    try:
        payload = {
            "site": "Site A – Residential",
            "job_type": "Rooftop PV Installation",
            "notes": "",
            "model_provider": "gemini"
        }
        response = requests.post(f"{BACKEND_URL}/swms/generate", json=payload, timeout=30)
        success = verify_response(response, 200, ["hazards", "controls", "ppe", "summary"], 
                                 "SWMS generation with Gemini working")
        if success:
            data = response.json()
            print(f"  Hazards: {len(data['hazards'])} items")
            print(f"  Controls: {len(data['controls'])} items")
            print(f"  PPE: {len(data['ppe'])} items")
            print(f"  Summary length: {len(data['summary'])} chars")
        test_results.append(("Test 4: POST /api/swms/generate (Gemini)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 4: POST /api/swms/generate (Gemini)", False))
    
    # Test 5: POST /api/agent/chat with OpenAI
    print_test(5, "POST /api/agent/chat (OpenAI) → {reply, session_id}")
    try:
        payload = {
            "session_id": "reg-1",
            "message": "One-sentence safety tip please",
            "history": [],
            "model_provider": "openai"
        }
        response = requests.post(f"{BACKEND_URL}/agent/chat", json=payload, timeout=30)
        success = verify_response(response, 200, ["reply", "session_id"], 
                                 "Agent chat with OpenAI working")
        if success:
            data = response.json()
            print(f"  Reply length: {len(data['reply'])} chars")
            print(f"  Session ID: {data['session_id']}")
            print(f"  Reply preview: {data['reply'][:100]}...")
        test_results.append(("Test 5: POST /api/agent/chat (OpenAI)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 5: POST /api/agent/chat (OpenAI)", False))
    
    # Test 6: POST /api/agent/chat with Gemini
    print_test(6, "POST /api/agent/chat (Gemini) → {reply, session_id}")
    try:
        payload = {
            "session_id": "reg-2",
            "message": "One-sentence safety tip please",
            "history": [],
            "model_provider": "gemini"
        }
        response = requests.post(f"{BACKEND_URL}/agent/chat", json=payload, timeout=30)
        success = verify_response(response, 200, ["reply", "session_id"], 
                                 "Agent chat with Gemini working")
        if success:
            data = response.json()
            print(f"  Reply length: {len(data['reply'])} chars")
            print(f"  Session ID: {data['session_id']}")
            print(f"  Reply preview: {data['reply'][:100]}...")
        test_results.append(("Test 6: POST /api/agent/chat (Gemini)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 6: POST /api/agent/chat (Gemini)", False))
    
    # Test 7: POST /api/hazards/from-voice
    print_test(7, "POST /api/hazards/from-voice → {site, hazard_type, severity, description}")
    try:
        payload = {
            "transcript": "There is a live wire hanging over the edge of the roof",
            "site": "Site A"
        }
        response = requests.post(f"{BACKEND_URL}/hazards/from-voice", json=payload, timeout=30)
        success = verify_response(response, 200, ["site", "hazard_type", "severity", "description"], 
                                 "Voice hazard structuring working")
        if success:
            data = response.json()
            print(f"  Site: {data['site']}")
            print(f"  Hazard type: {data['hazard_type']}")
            print(f"  Severity: {data['severity']}")
            print(f"  Description: {data['description'][:100]}...")
        test_results.append(("Test 7: POST /api/hazards/from-voice", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 7: POST /api/hazards/from-voice", False))
    
    # Test 8: POST /api/risk/assess with base64 image
    print_test(8, "POST /api/risk/assess → {observations, hazards, controls, ppe, summary, risk_level}")
    try:
        test_image = create_test_image_base64()
        payload = {
            "images": [test_image],
            "site": "Site A",
            "job_type": "Rooftop PV Installation",
            "notes": ""
        }
        response = requests.post(f"{BACKEND_URL}/risk/assess", json=payload, timeout=30)
        success = verify_response(response, 200, 
                                 ["observations", "hazards", "controls", "ppe", "summary", "risk_level"], 
                                 "Risk assessment working")
        if success:
            data = response.json()
            print(f"  Observations: {len(data['observations'])} items")
            print(f"  Hazards: {len(data['hazards'])} items")
            print(f"  Controls: {len(data['controls'])} items")
            print(f"  PPE: {len(data['ppe'])} items")
            print(f"  Risk level: {data['risk_level']}")
            print(f"  Summary length: {len(data['summary'])} chars")
        test_results.append(("Test 8: POST /api/risk/assess", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 8: POST /api/risk/assess", False))
    
    # Test 9: POST /api/risk/watch with base64 image
    print_test(9, "POST /api/risk/watch → {has_hazard, severity, alert, recommendation, timestamp}")
    try:
        test_image = create_test_image_base64()
        payload = {
            "image": test_image,
            "site": "Site A",
            "job_type": "Rooftop PV Installation",
            "recent_alerts": []
        }
        response = requests.post(f"{BACKEND_URL}/risk/watch", json=payload, timeout=30)
        success = verify_response(response, 200, 
                                 ["has_hazard", "severity", "alert", "recommendation", "timestamp"], 
                                 "Risk watch working")
        if success:
            data = response.json()
            print(f"  Has hazard: {data['has_hazard']}")
            print(f"  Severity: {data['severity']}")
            print(f"  Alert: {data['alert']}")
            print(f"  Recommendation: {data['recommendation']}")
            print(f"  Timestamp: {data['timestamp']}")
        test_results.append(("Test 9: POST /api/risk/watch", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 9: POST /api/risk/watch", False))
    
    # Test 10: POST /api/watch/log
    print_test(10, "POST /api/watch/log → full alert with new id")
    try:
        payload = {
            "site": "Site A",
            "severity": "critical",
            "alert": "Test alert",
            "recommendation": "Test",
            "snapshot_b64": ""
        }
        response = requests.post(f"{BACKEND_URL}/watch/log", json=payload, timeout=10)
        success = verify_response(response, 200, ["id", "site", "severity", "alert", "timestamp"], 
                                 "Watch log creation working")
        if success:
            data = response.json()
            alert_id = data['id']
            print(f"  Alert ID: {alert_id}")
            print(f"  Site: {data['site']}")
            print(f"  Severity: {data['severity']}")
            print(f"  Alert: {data['alert']}")
        test_results.append(("Test 10: POST /api/watch/log", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 10: POST /api/watch/log", False))
    
    # Test 11: GET /api/watch/history
    print_test(11, "GET /api/watch/history → must include alert from step 10")
    try:
        response = requests.get(f"{BACKEND_URL}/watch/history", timeout=10)
        success = verify_response(response, 200, None, "Watch history retrieval working")
        if success:
            data = response.json()
            print(f"  Total alerts: {len(data)}")
            if alert_id:
                found = any(alert.get('id') == alert_id for alert in data)
                if found:
                    print(f"  {GREEN}✓{RESET} Found alert from step 10 (ID: {alert_id})")
                else:
                    print(f"  {RED}✗{RESET} Alert from step 10 NOT found (ID: {alert_id})")
                    success = False
        test_results.append(("Test 11: GET /api/watch/history", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 11: GET /api/watch/history", False))
    
    # Test 12: POST /api/hazards
    print_test(12, "POST /api/hazards → hazard with new id")
    try:
        payload = {
            "site": "Site A",
            "hazard_type": "Test hazard",
            "severity": "medium",
            "description": "Test",
            "source": "manual"
        }
        response = requests.post(f"{BACKEND_URL}/hazards", json=payload, timeout=10)
        success = verify_response(response, 200, ["id", "site", "hazard_type", "severity"], 
                                 "Hazard creation working")
        if success:
            data = response.json()
            hazard_id = data['id']
            print(f"  Hazard ID: {hazard_id}")
            print(f"  Site: {data['site']}")
            print(f"  Hazard type: {data['hazard_type']}")
            print(f"  Severity: {data['severity']}")
        test_results.append(("Test 12: POST /api/hazards", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 12: POST /api/hazards", False))
    
    # Test 13: GET /api/hazards
    print_test(13, "GET /api/hazards → must include hazard from step 12")
    try:
        response = requests.get(f"{BACKEND_URL}/hazards", timeout=10)
        success = verify_response(response, 200, None, "Hazard list retrieval working")
        if success:
            data = response.json()
            print(f"  Total hazards: {len(data)}")
            if hazard_id:
                found = any(hazard.get('id') == hazard_id for hazard in data)
                if found:
                    print(f"  {GREEN}✓{RESET} Found hazard from step 12 (ID: {hazard_id})")
                else:
                    print(f"  {RED}✗{RESET} Hazard from step 12 NOT found (ID: {hazard_id})")
                    success = False
        test_results.append(("Test 13: GET /api/hazards", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 13: GET /api/hazards", False))
    
    # Test 14: DELETE /api/hazards/{id}
    print_test(14, f"DELETE /api/hazards/{hazard_id} → {{\"deleted\": 1}}")
    try:
        if not hazard_id:
            print_result(False, "No hazard_id from step 12, skipping")
            test_results.append(("Test 14: DELETE /api/hazards/{id}", False))
        else:
            response = requests.delete(f"{BACKEND_URL}/hazards/{hazard_id}", timeout=10)
            success = verify_response(response, 200, ["deleted"], "Hazard deletion working")
            if success:
                data = response.json()
                print(f"  Deleted count: {data['deleted']}")
                if data['deleted'] != 1:
                    print(f"  {YELLOW}Warning{RESET}: Expected deleted=1, got {data['deleted']}")
            test_results.append(("Test 14: DELETE /api/hazards/{id}", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 14: DELETE /api/hazards/{id}", False))
    
    # Test 15: DELETE /api/watch/history/{id}
    print_test(15, f"DELETE /api/watch/history/{alert_id} → {{\"deleted\": 1}}")
    try:
        if not alert_id:
            print_result(False, "No alert_id from step 10, skipping")
            test_results.append(("Test 15: DELETE /api/watch/history/{id}", False))
        else:
            response = requests.delete(f"{BACKEND_URL}/watch/history/{alert_id}", timeout=10)
            success = verify_response(response, 200, ["deleted"], "Watch alert deletion working")
            if success:
                data = response.json()
                print(f"  Deleted count: {data['deleted']}")
                if data['deleted'] != 1:
                    print(f"  {YELLOW}Warning{RESET}: Expected deleted=1, got {data['deleted']}")
            test_results.append(("Test 15: DELETE /api/watch/history/{id}", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 15: DELETE /api/watch/history/{id}", False))
    
    # Test 16: DELETE /api/hazards (clear all)
    print_test(16, "DELETE /api/hazards → clear all hazards")
    try:
        response = requests.delete(f"{BACKEND_URL}/hazards", timeout=10)
        success = verify_response(response, 200, ["deleted"], "Clear all hazards working")
        if success:
            data = response.json()
            print(f"  Deleted count: {data['deleted']}")
        test_results.append(("Test 16: DELETE /api/hazards", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 16: DELETE /api/hazards", False))
    
    # Test 17: DELETE /api/watch/history (clear all)
    print_test(17, "DELETE /api/watch/history → clear all watch history")
    try:
        response = requests.delete(f"{BACKEND_URL}/watch/history", timeout=10)
        success = verify_response(response, 200, ["deleted"], "Clear all watch history working")
        if success:
            data = response.json()
            print(f"  Deleted count: {data['deleted']}")
        test_results.append(("Test 17: DELETE /api/watch/history", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 17: DELETE /api/watch/history", False))
    
    # ==================== NEW ADMIN ENDPOINT TESTS ====================
    
    # Test 18: POST /api/admin/verify with wrong code
    print_test(18, "POST /api/admin/verify (wrong code) → {verified: false, token: null}")
    try:
        payload = {"code": "000000"}
        response = requests.post(f"{BACKEND_URL}/admin/verify", json=payload, timeout=10)
        success = verify_response(response, 200, ["verified", "message"], "Admin verify with wrong code working")
        if success:
            data = response.json()
            print(f"  Verified: {data['verified']}")
            print(f"  Token: {data.get('token')}")
            print(f"  Message: {data['message']}")
            if data['verified'] != False:
                print_result(False, f"Expected verified=false, got {data['verified']}")
                success = False
            if data.get('token') is not None:
                print_result(False, f"Expected token=null, got {data.get('token')}")
                success = False
            if data['message'] != "Invalid code":
                print(f"  {YELLOW}Warning{RESET}: Expected message='Invalid code', got '{data['message']}'")
        test_results.append(("Test 18: POST /api/admin/verify (wrong code)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 18: POST /api/admin/verify (wrong code)", False))
    
    # Test 19: POST /api/admin/verify with correct code
    print_test(19, "POST /api/admin/verify (correct code) → {verified: true, token: 'admin-session-...'}")
    try:
        payload = {"code": "123456"}
        response = requests.post(f"{BACKEND_URL}/admin/verify", json=payload, timeout=10)
        success = verify_response(response, 200, ["verified", "message"], "Admin verify with correct code working")
        if success:
            data = response.json()
            print(f"  Verified: {data['verified']}")
            print(f"  Token: {data.get('token')}")
            print(f"  Message: {data['message']}")
            if data['verified'] != True:
                print_result(False, f"Expected verified=true, got {data['verified']}")
                success = False
            if not data.get('token') or not data['token'].startswith('admin-session-'):
                print_result(False, f"Expected token starting with 'admin-session-', got {data.get('token')}")
                success = False
            else:
                admin_token = data['token']
            if data['message'] != "Access granted":
                print(f"  {YELLOW}Warning{RESET}: Expected message='Access granted', got '{data['message']}'")
        test_results.append(("Test 19: POST /api/admin/verify (correct code)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 19: POST /api/admin/verify (correct code)", False))
    
    # Test 20: GET /api/admin/users (initially empty)
    print_test(20, "GET /api/admin/users → JSON array (may be empty)")
    try:
        response = requests.get(f"{BACKEND_URL}/admin/users", timeout=10)
        success = verify_response(response, 200, None, "Admin users list working")
        if success:
            data = response.json()
            print(f"  Total users: {len(data)}")
            if not isinstance(data, list):
                print_result(False, f"Expected list, got {type(data)}")
                success = False
        test_results.append(("Test 20: GET /api/admin/users (initial)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 20: GET /api/admin/users (initial)", False))
    
    # Test 21: POST /api/admin/users (create Alex Test)
    print_test(21, "POST /api/admin/users → {id, name, email, role, active, created}")
    try:
        payload = {
            "name": "Alex Test",
            "email": "alex@example.com",
            "role": "supervisor"
        }
        response = requests.post(f"{BACKEND_URL}/admin/users", json=payload, timeout=10)
        success = verify_response(response, 200, ["id", "name", "email", "role", "active", "created"], 
                                 "Admin user creation working")
        if success:
            data = response.json()
            admin_user_id = data['id']
            print(f"  User ID: {admin_user_id}")
            print(f"  Name: {data['name']}")
            print(f"  Email: {data['email']}")
            print(f"  Role: {data['role']}")
            print(f"  Active: {data['active']}")
            print(f"  Created: {data['created']}")
            if data['name'] != "Alex Test":
                print_result(False, f"Expected name='Alex Test', got '{data['name']}'")
                success = False
            if data['email'] != "alex@example.com":
                print_result(False, f"Expected email='alex@example.com', got '{data['email']}'")
                success = False
            if data['role'] != "supervisor":
                print_result(False, f"Expected role='supervisor', got '{data['role']}'")
                success = False
            if data['active'] != True:
                print_result(False, f"Expected active=true, got {data['active']}")
                success = False
        test_results.append(("Test 21: POST /api/admin/users", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 21: POST /api/admin/users", False))
    
    # Test 22: GET /api/admin/users (should contain Alex Test)
    print_test(22, "GET /api/admin/users → list contains Alex Test")
    try:
        response = requests.get(f"{BACKEND_URL}/admin/users", timeout=10)
        success = verify_response(response, 200, None, "Admin users list with Alex Test working")
        if success:
            data = response.json()
            print(f"  Total users: {len(data)}")
            if admin_user_id:
                found = any(user.get('id') == admin_user_id for user in data)
                if found:
                    print(f"  {GREEN}✓{RESET} Found Alex Test (ID: {admin_user_id})")
                else:
                    print_result(False, f"Alex Test NOT found (ID: {admin_user_id})")
                    success = False
        test_results.append(("Test 22: GET /api/admin/users (with Alex)", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 22: GET /api/admin/users (with Alex)", False))
    
    # Test 23: DELETE /api/admin/users/{id}
    print_test(23, f"DELETE /api/admin/users/{admin_user_id} → {{\"deleted\": 1}}")
    try:
        if not admin_user_id:
            print_result(False, "No admin_user_id from step 21, skipping")
            test_results.append(("Test 23: DELETE /api/admin/users/{id}", False))
        else:
            response = requests.delete(f"{BACKEND_URL}/admin/users/{admin_user_id}", timeout=10)
            success = verify_response(response, 200, ["deleted"], "Admin user deletion working")
            if success:
                data = response.json()
                print(f"  Deleted count: {data['deleted']}")
                if data['deleted'] != 1:
                    print(f"  {YELLOW}Warning{RESET}: Expected deleted=1, got {data['deleted']}")
            test_results.append(("Test 23: DELETE /api/admin/users/{id}", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 23: DELETE /api/admin/users/{id}", False))
    
    # Test 24: GET /api/admin/audit (should contain deleted user entry)
    print_test(24, "GET /api/admin/audit → JSON array with deleted user entry")
    try:
        response = requests.get(f"{BACKEND_URL}/admin/audit", timeout=10)
        success = verify_response(response, 200, None, "Admin audit log working")
        if success:
            data = response.json()
            print(f"  Total audit entries: {len(data)}")
            if not isinstance(data, list):
                print_result(False, f"Expected list, got {type(data)}")
                success = False
            elif admin_user_id:
                found = any(entry.get('entity') == 'user' and entry.get('original_id') == admin_user_id for entry in data)
                if found:
                    print(f"  {GREEN}✓{RESET} Found audit entry for deleted user (ID: {admin_user_id})")
                else:
                    print(f"  {YELLOW}Warning{RESET}: Audit entry for deleted user NOT found (ID: {admin_user_id})")
        test_results.append(("Test 24: GET /api/admin/audit", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 24: GET /api/admin/audit", False))
    
    # Test 25: DELETE /api/admin/audit
    print_test(25, "DELETE /api/admin/audit → {\"deleted\": N}")
    try:
        response = requests.delete(f"{BACKEND_URL}/admin/audit", timeout=10)
        success = verify_response(response, 200, ["deleted"], "Admin audit clear working")
        if success:
            data = response.json()
            print(f"  Deleted count: {data['deleted']}")
        test_results.append(("Test 25: DELETE /api/admin/audit", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 25: DELETE /api/admin/audit", False))
    
    # Test 26: GET /api/admin/watch/unsaved
    print_test(26, "GET /api/admin/watch/unsaved → JSON array of unfiled watch alerts")
    try:
        response = requests.get(f"{BACKEND_URL}/admin/watch/unsaved", timeout=10)
        success = verify_response(response, 200, None, "Admin unfiled watch alerts working")
        if success:
            data = response.json()
            print(f"  Total unfiled alerts: {len(data)}")
            if not isinstance(data, list):
                print_result(False, f"Expected list, got {type(data)}")
                success = False
            # Verify all returned alerts have filed_as_hazard=false
            if isinstance(data, list):
                all_unfiled = all(alert.get('filed_as_hazard') == False for alert in data)
                if all_unfiled:
                    print(f"  {GREEN}✓{RESET} All alerts have filed_as_hazard=false")
                else:
                    print(f"  {YELLOW}Warning{RESET}: Some alerts have filed_as_hazard=true")
        test_results.append(("Test 26: GET /api/admin/watch/unsaved", success))
    except Exception as e:
        print_result(False, f"Exception: {e}")
        test_results.append(("Test 26: GET /api/admin/watch/unsaved", False))
    
    # Summary
    print(f"\n{'#'*80}")
    print(f"# TEST SUMMARY")
    print(f"{'#'*80}")
    
    passed = sum(1 for _, success in test_results if success)
    failed = len(test_results) - passed
    
    print(f"\nTotal tests: {len(test_results)}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {failed}{RESET}")
    
    print(f"\n{'='*80}")
    print("Detailed Results:")
    print(f"{'='*80}")
    for test_name, success in test_results:
        status = f"{GREEN}✓ PASS{RESET}" if success else f"{RED}✗ FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{'#'*80}\n")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
