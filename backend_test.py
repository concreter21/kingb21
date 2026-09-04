#!/usr/bin/env python3
"""
Backend API Testing Suite for SafePro SWMS Application
Tests all backend endpoints including the new AI SWMS generation endpoint.
"""

import requests
import json
import time
import base64
import io
from typing import Dict, Any
from PIL import Image

# Backend URL from frontend/.env
BACKEND_URL = "https://komma5-safepro.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test_header(test_name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def generate_tiny_png_base64() -> str:
    """Generate a small 8x8 red PNG image in base64 format"""
    img = Image.new("RGB", (8, 8), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return b64

def test_root_endpoint():
    """Test GET /api/ endpoint"""
    print_test_header("GET /api/ - Root Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print_success("Root endpoint returned 200 status")
            
            data = response.json()
            if "message" in data:
                print_success(f"Response contains 'message' field: {data['message']}")
                return True
            else:
                print_error("Response missing 'message' field")
                return False
        else:
            print_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_status_endpoints():
    """Test POST /api/status and GET /api/status endpoints"""
    print_test_header("POST /api/status - Create Status Check")
    
    try:
        # Test POST /api/status
        test_data = {
            "client_name": "Test Client - SafePro SWMS"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/status",
            json=test_data,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print_success("Status creation returned 200 status")
            
            data = response.json()
            required_fields = ["id", "client_name", "timestamp"]
            
            all_fields_present = True
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
                
            # Test GET /api/status
            print_test_header("GET /api/status - Get Status Checks")
            
            get_response = requests.get(f"{BACKEND_URL}/status", timeout=10)
            print(f"Status Code: {get_response.status_code}")
            
            if get_response.status_code == 200:
                print_success("Status retrieval returned 200 status")
                
                status_list = get_response.json()
                if isinstance(status_list, list):
                    print_success(f"Response is a list with {len(status_list)} items")
                    
                    if len(status_list) > 0:
                        print_success("Status list contains data")
                        print(f"Sample item: {json.dumps(status_list[0], indent=2)}")
                    else:
                        print_warning("Status list is empty (may be expected if database is fresh)")
                    
                    return True
                else:
                    print_error("Response is not a list")
                    return False
            else:
                print_error(f"GET /api/status returned {get_response.status_code}")
                return False
        else:
            print_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_swms_generate_endpoint():
    """Test POST /api/swms/generate endpoint with AI generation"""
    print_test_header("POST /api/swms/generate - AI SWMS Generation")
    
    try:
        # Test data from review request
        test_data = {
            "site": "Warehouse Array – Hamburg Hafen",
            "job_type": "Commercial Array Mounting – 150kW",
            "notes": "Steep pitch roof, adjacent live overhead line"
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        # Track response time
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/swms/generate",
            json=test_data,
            timeout=35  # Slightly more than 30s requirement
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        # Check response time
        if response_time < 30:
            print_success(f"Response time ({response_time:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response.status_code == 200:
            print_success("SWMS generation returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["hazards", "controls", "ppe", "summary"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate list fields have meaningful content
            list_fields = ["hazards", "controls", "ppe"]
            all_lists_valid = True
            
            for field in list_fields:
                if isinstance(data[field], list):
                    if len(data[field]) > 0:
                        print_success(f"'{field}' is a non-empty list with {len(data[field])} items")
                        # Show first item as sample
                        print(f"  Sample: {data[field][0]}")
                    else:
                        print_error(f"'{field}' is an empty list")
                        all_lists_valid = False
                else:
                    print_error(f"'{field}' is not a list")
                    all_lists_valid = False
            
            # Validate summary
            if isinstance(data["summary"], str):
                if len(data["summary"]) > 0:
                    print_success(f"'summary' is a non-empty string ({len(data['summary'])} characters)")
                    print(f"  Summary: {data['summary'][:100]}...")
                else:
                    print_error("'summary' is an empty string")
                    all_lists_valid = False
            else:
                print_error("'summary' is not a string")
                all_lists_valid = False
            
            return all_lists_valid
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
            
    except requests.Timeout:
        print_error("Request timed out (>35 seconds)")
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_agent_chat_endpoint():
    """Test POST /api/agent/chat endpoint with and without history"""
    print_test_header("POST /api/agent/chat - AI Agent Chat (Without History)")
    
    try:
        # Test 1: Without history
        test_data_no_history = {
            "session_id": "test-session-001",
            "message": "How do I safely isolate DC before rooftop PV work?",
            "history": []
        }
        
        print(f"Request payload (without history):")
        print(json.dumps(test_data_no_history, indent=2))
        
        # Track response time
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/agent/chat",
            json=test_data_no_history,
            timeout=35  # 30s requirement + buffer
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        # Check response time
        if response_time < 30:
            print_success(f"Response time ({response_time:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response.status_code == 200:
            print_success("Agent chat returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["reply", "session_id"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate reply is non-empty string
            if isinstance(data["reply"], str):
                if len(data["reply"]) > 0:
                    print_success(f"'reply' is a non-empty string ({len(data['reply'])} characters)")
                    print(f"  Reply preview: {data['reply'][:150]}...")
                    
                    # Check if reply is contextually relevant to solar safety
                    solar_keywords = ["dc", "isolate", "solar", "pv", "safety", "lockout", "tagout", "circuit", "electrical", "disconnect"]
                    reply_lower = data["reply"].lower()
                    relevant = any(keyword in reply_lower for keyword in solar_keywords)
                    
                    if relevant:
                        print_success("Reply appears contextually relevant to solar safety")
                    else:
                        print_warning("Reply may not be contextually relevant to solar safety")
                else:
                    print_error("'reply' is an empty string")
                    return False
            else:
                print_error("'reply' is not a string")
                return False
            
            # Validate session_id matches input
            if data["session_id"] == test_data_no_history["session_id"]:
                print_success(f"'session_id' matches input: {data['session_id']}")
            else:
                print_error(f"'session_id' mismatch. Expected: {test_data_no_history['session_id']}, Got: {data['session_id']}")
                return False
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
        
        # Test 2: With history
        print_test_header("POST /api/agent/chat - AI Agent Chat (With History)")
        
        test_data_with_history = {
            "session_id": "test-session-001",
            "message": "What PPE should I add?",
            "history": [
                {"role": "user", "content": "Working on a 400kW commercial roof array"},
                {"role": "assistant", "content": "Ensure LOTO and fall protection."}
            ]
        }
        
        print(f"Request payload (with history):")
        print(json.dumps(test_data_with_history, indent=2))
        
        # Track response time
        start_time = time.time()
        
        response_with_history = requests.post(
            f"{BACKEND_URL}/agent/chat",
            json=test_data_with_history,
            timeout=35
        )
        
        end_time = time.time()
        response_time_with_history = end_time - start_time
        
        print(f"\nStatus Code: {response_with_history.status_code}")
        print(f"Response Time: {response_time_with_history:.2f} seconds")
        
        # Check response time
        if response_time_with_history < 30:
            print_success(f"Response time ({response_time_with_history:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time_with_history:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response_with_history.status_code == 200:
            print_success("Agent chat with history returned 200 status")
        else:
            print_error(f"Expected 200, got {response_with_history.status_code}")
            print(f"Response body: {response_with_history.text}")
            return False
        
        # Parse and validate response
        try:
            data_with_history = response_with_history.json()
            print(f"\nResponse structure:")
            print(json.dumps(data_with_history, indent=2))
            
            # Check required fields
            all_fields_present = True
            
            for field in required_fields:
                if field in data_with_history:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate reply is non-empty string
            if isinstance(data_with_history["reply"], str):
                if len(data_with_history["reply"]) > 0:
                    print_success(f"'reply' is a non-empty string ({len(data_with_history['reply'])} characters)")
                    print(f"  Reply preview: {data_with_history['reply'][:150]}...")
                    
                    # Check if reply is contextually relevant to PPE
                    ppe_keywords = ["ppe", "helmet", "gloves", "boots", "harness", "glasses", "vest", "protection", "safety"]
                    reply_lower = data_with_history["reply"].lower()
                    relevant = any(keyword in reply_lower for keyword in ppe_keywords)
                    
                    if relevant:
                        print_success("Reply appears contextually relevant to PPE question")
                    else:
                        print_warning("Reply may not be contextually relevant to PPE question")
                else:
                    print_error("'reply' is an empty string")
                    return False
            else:
                print_error("'reply' is not a string")
                return False
            
            # Validate session_id matches input
            if data_with_history["session_id"] == test_data_with_history["session_id"]:
                print_success(f"'session_id' matches input: {data_with_history['session_id']}")
            else:
                print_error(f"'session_id' mismatch. Expected: {test_data_with_history['session_id']}, Got: {data_with_history['session_id']}")
                return False
            
            return True
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response_with_history.text}")
            return False
            
    except requests.Timeout:
        print_error("Request timed out (>35 seconds)")
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_hazards_from_voice_endpoint():
    """Test POST /api/hazards/from-voice endpoint"""
    print_test_header("POST /api/hazards/from-voice - Voice Hazard Structuring")
    
    try:
        # Test data from review request
        test_data = {
            "transcript": "There is an exposed live conductor near the junction box on the north side of the Hamburg warehouse. It looks pretty serious.",
            "site": "Warehouse Array – Hamburg Hafen"
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        # Track response time
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/hazards/from-voice",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        # Check response time
        if response_time < 30:
            print_success(f"Response time ({response_time:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response.status_code == 200:
            print_success("Voice hazard endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["site", "hazard_type", "severity", "description"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate site is a string
            if isinstance(data["site"], str):
                if len(data["site"]) > 0:
                    print_success(f"'site' is a non-empty string: {data['site']}")
                else:
                    print_error("'site' is an empty string")
                    return False
            else:
                print_error("'site' is not a string")
                return False
            
            # Validate hazard_type is a string
            if isinstance(data["hazard_type"], str):
                if len(data["hazard_type"]) > 0:
                    print_success(f"'hazard_type' is a non-empty string: {data['hazard_type']}")
                else:
                    print_error("'hazard_type' is an empty string")
                    return False
            else:
                print_error("'hazard_type' is not a string")
                return False
            
            # Validate severity is one of the allowed values
            allowed_severities = ["low", "medium", "high", "critical"]
            if data["severity"] in allowed_severities:
                print_success(f"'severity' is valid: {data['severity']}")
            else:
                print_error(f"'severity' must be one of {allowed_severities}, got: {data['severity']}")
                return False
            
            # Validate description is a string
            if isinstance(data["description"], str):
                if len(data["description"]) > 0:
                    print_success(f"'description' is a non-empty string ({len(data['description'])} characters)")
                    print(f"  Description: {data['description'][:150]}...")
                    
                    # Check if description is contextually accurate
                    transcript_keywords = ["exposed", "live", "conductor", "junction", "box", "hamburg", "warehouse", "serious"]
                    description_lower = data["description"].lower()
                    relevant_count = sum(1 for keyword in transcript_keywords if keyword in description_lower)
                    
                    if relevant_count >= 2:
                        print_success(f"Description appears contextually accurate (matched {relevant_count} keywords)")
                    else:
                        print_warning(f"Description may not be contextually accurate (matched only {relevant_count} keywords)")
                else:
                    print_error("'description' is an empty string")
                    return False
            else:
                print_error("'description' is not a string")
                return False
            
            return True
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
            
    except requests.Timeout:
        print_error("Request timed out (>35 seconds)")
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_risk_assess_endpoint():
    """Test POST /api/risk/assess endpoint with vision AI"""
    print_test_header("POST /api/risk/assess - Vision Risk Assessment")
    
    try:
        # Generate a small PNG image
        tiny_png_base64 = generate_tiny_png_base64()
        
        # Test data from review request
        test_data = {
            "images": [tiny_png_base64],
            "site": "Villa – Grunewald",
            "job_type": "Rooftop PV Installation – 8kW Domestic",
            "notes": "Steep tile roof"
        }
        
        print(f"Request payload:")
        print(f"  site: {test_data['site']}")
        print(f"  job_type: {test_data['job_type']}")
        print(f"  notes: {test_data['notes']}")
        print(f"  images: [<base64 PNG image, {len(tiny_png_base64)} chars>]")
        
        # Track response time
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/risk/assess",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        # Check response time
        if response_time < 30:
            print_success(f"Response time ({response_time:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response.status_code == 200:
            print_success("Risk assessment endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["observations", "hazards", "controls", "ppe", "summary", "risk_level"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate list fields are non-empty
            list_fields = ["observations", "hazards", "controls", "ppe"]
            all_lists_valid = True
            
            for field in list_fields:
                if isinstance(data[field], list):
                    if len(data[field]) > 0:
                        print_success(f"'{field}' is a non-empty list with {len(data[field])} items")
                        # Show first item as sample
                        print(f"  Sample: {data[field][0]}")
                    else:
                        print_error(f"'{field}' is an empty list")
                        all_lists_valid = False
                else:
                    print_error(f"'{field}' is not a list")
                    all_lists_valid = False
            
            if not all_lists_valid:
                return False
            
            # Validate summary is a non-empty string
            if isinstance(data["summary"], str):
                if len(data["summary"]) > 0:
                    print_success(f"'summary' is a non-empty string ({len(data['summary'])} characters)")
                    print(f"  Summary: {data['summary'][:150]}...")
                else:
                    print_error("'summary' is an empty string")
                    return False
            else:
                print_error("'summary' is not a string")
                return False
            
            # Validate risk_level is one of the allowed values
            allowed_risk_levels = ["low", "medium", "high", "critical"]
            if data["risk_level"] in allowed_risk_levels:
                print_success(f"'risk_level' is valid: {data['risk_level']}")
            else:
                print_error(f"'risk_level' must be one of {allowed_risk_levels}, got: {data['risk_level']}")
                return False
            
            return True
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
            
    except requests.Timeout:
        print_error("Request timed out (>35 seconds)")
        return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests and report results"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}SafePro SWMS Backend API Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    results = {}
    
    # Test 1: Root endpoint
    results["GET /api/"] = test_root_endpoint()
    
    # Test 2: Status endpoints
    results["Status endpoints"] = test_status_endpoints()
    
    # Test 3: SWMS generation endpoint
    results["POST /api/swms/generate"] = test_swms_generate_endpoint()
    
    # Test 4: Agent chat endpoint
    results["POST /api/agent/chat"] = test_agent_chat_endpoint()
    
    # Test 5: Voice hazard endpoint (NEW)
    results["POST /api/hazards/from-voice"] = test_hazards_from_voice_endpoint()
    
    # Test 6: Risk assessment endpoint (NEW)
    results["POST /api/risk/assess"] = test_risk_assess_endpoint()
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Test Summary{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}All tests passed!{Colors.END}")
        return 0
    else:
        print(f"{Colors.RED}Some tests failed!{Colors.END}")
        return 1

if __name__ == "__main__":
    exit(run_all_tests())
