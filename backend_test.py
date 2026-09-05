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

def test_risk_watch_endpoint():
    """Test POST /api/risk/watch endpoint for continuous risk monitoring"""
    print_test_header("POST /api/risk/watch - Continuous Risk Monitoring")
    
    try:
        # Generate a small 32x32 JPEG image as per review request
        img = Image.new("RGB", (32, 32), (100, 100, 100))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        
        # Test data from review request
        test_data = {
            "image": b64,
            "site": "Warehouse Array – Hamburg Hafen",
            "job_type": "Warehouse Ballasted Array",
            "recent_alerts": ["Worker without harness at edge"]
        }
        
        print(f"Request payload:")
        print(f"  site: {test_data['site']}")
        print(f"  job_type: {test_data['job_type']}")
        print(f"  recent_alerts: {test_data['recent_alerts']}")
        print(f"  image: <base64 JPEG image, {len(b64)} chars>")
        
        # Track response time
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/risk/watch",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        # Check response time (requirement: within 30s)
        if response_time < 30:
            print_success(f"Response time ({response_time:.2f}s) is under 30 seconds")
        else:
            print_warning(f"Response time ({response_time:.2f}s) exceeds 30 seconds")
        
        # Check status code
        if response.status_code == 200:
            print_success("Risk watch endpoint returned 200 status")
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
            required_fields = ["has_hazard", "severity", "alert", "recommendation", "timestamp"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False
            
            # Validate has_hazard is a boolean
            if isinstance(data["has_hazard"], bool):
                print_success(f"'has_hazard' is a boolean: {data['has_hazard']}")
            else:
                print_error(f"'has_hazard' must be a boolean, got: {type(data['has_hazard'])}")
                return False
            
            # Validate severity is one of the allowed values
            allowed_severities = ["none", "low", "medium", "high", "critical"]
            if data["severity"] in allowed_severities:
                print_success(f"'severity' is valid: {data['severity']}")
            else:
                print_error(f"'severity' must be one of {allowed_severities}, got: {data['severity']}")
                return False
            
            # Validate alert is a string
            if isinstance(data["alert"], str):
                print_success(f"'alert' is a string ({len(data['alert'])} characters)")
                if len(data["alert"]) > 0:
                    print(f"  Alert: {data['alert']}")
            else:
                print_error(f"'alert' must be a string, got: {type(data['alert'])}")
                return False
            
            # Validate recommendation is a string
            if isinstance(data["recommendation"], str):
                print_success(f"'recommendation' is a string ({len(data['recommendation'])} characters)")
                if len(data["recommendation"]) > 0:
                    print(f"  Recommendation: {data['recommendation']}")
            else:
                print_error(f"'recommendation' must be a string, got: {type(data['recommendation'])}")
                return False
            
            # Validate timestamp is an ISO string
            if isinstance(data["timestamp"], str):
                try:
                    # Try to parse as ISO datetime
                    from datetime import datetime
                    datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
                    print_success(f"'timestamp' is a valid ISO string: {data['timestamp']}")
                except ValueError:
                    print_error(f"'timestamp' is not a valid ISO datetime string: {data['timestamp']}")
                    return False
            else:
                print_error(f"'timestamp' must be a string, got: {type(data['timestamp'])}")
                return False
            
            # Validate business logic: if severity is "none", has_hazard should be false
            if data["severity"] == "none" and data["has_hazard"] == True:
                print_error("Business logic error: severity is 'none' but has_hazard is True")
                return False
            elif data["severity"] == "none" and data["has_hazard"] == False:
                print_success("Business logic correct: severity is 'none' and has_hazard is False")
            
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

def test_watch_log_endpoint():
    """Test POST /api/watch/log endpoint"""
    print_test_header("POST /api/watch/log - Log Watch Alert")
    
    try:
        # Test data from review request
        test_data = {
            "site": "Warehouse Array – Hamburg Hafen",
            "job_type": "Warehouse Ballasted Array",
            "severity": "critical",
            "alert": "Worker without harness near unprotected edge",
            "recommendation": "Attach fall-arrest immediately and clear the area",
            "snapshot_b64": "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQIW2NgYGBgAAAABQABDQottAAAAABJRU5ErkJggg=="
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        response = requests.post(
            f"{BACKEND_URL}/watch/log",
            json=test_data,
            timeout=10
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Watch log endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False, None
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["id", "site", "job_type", "severity", "alert", "recommendation", "snapshot_b64", "timestamp", "filed_as_hazard", "hazard_id"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False, None
            
            # Validate id is a UUID string
            if isinstance(data["id"], str) and len(data["id"]) > 0:
                print_success(f"'id' is a non-empty string (UUID): {data['id']}")
            else:
                print_error("'id' is not a valid UUID string")
                return False, None
            
            # Validate input fields are echoed correctly
            if data["site"] == test_data["site"]:
                print_success(f"'site' matches input: {data['site']}")
            else:
                print_error(f"'site' mismatch. Expected: {test_data['site']}, Got: {data['site']}")
                return False, None
            
            if data["job_type"] == test_data["job_type"]:
                print_success(f"'job_type' matches input: {data['job_type']}")
            else:
                print_error(f"'job_type' mismatch. Expected: {test_data['job_type']}, Got: {data['job_type']}")
                return False, None
            
            if data["severity"] == test_data["severity"]:
                print_success(f"'severity' matches input: {data['severity']}")
            else:
                print_error(f"'severity' mismatch. Expected: {test_data['severity']}, Got: {data['severity']}")
                return False, None
            
            if data["alert"] == test_data["alert"]:
                print_success(f"'alert' matches input: {data['alert']}")
            else:
                print_error(f"'alert' mismatch. Expected: {test_data['alert']}, Got: {data['alert']}")
                return False, None
            
            if data["recommendation"] == test_data["recommendation"]:
                print_success(f"'recommendation' matches input: {data['recommendation']}")
            else:
                print_error(f"'recommendation' mismatch. Expected: {test_data['recommendation']}, Got: {data['recommendation']}")
                return False, None
            
            if data["snapshot_b64"] == test_data["snapshot_b64"]:
                print_success(f"'snapshot_b64' matches input")
            else:
                print_error(f"'snapshot_b64' mismatch")
                return False, None
            
            # Validate timestamp is an ISO string
            if isinstance(data["timestamp"], str):
                try:
                    from datetime import datetime
                    datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
                    print_success(f"'timestamp' is a valid ISO string: {data['timestamp']}")
                except ValueError:
                    print_error(f"'timestamp' is not a valid ISO datetime string: {data['timestamp']}")
                    return False, None
            else:
                print_error(f"'timestamp' must be a string, got: {type(data['timestamp'])}")
                return False, None
            
            # Validate filed_as_hazard is false initially
            if data["filed_as_hazard"] == False:
                print_success(f"'filed_as_hazard' is False (as expected initially)")
            else:
                print_error(f"'filed_as_hazard' should be False initially, got: {data['filed_as_hazard']}")
                return False, None
            
            # Validate hazard_id is null initially
            if data["hazard_id"] is None:
                print_success(f"'hazard_id' is null (as expected initially)")
            else:
                print_error(f"'hazard_id' should be null initially, got: {data['hazard_id']}")
                return False, None
            
            # Return the watch alert ID for use in subsequent tests
            return True, data["id"]
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False, None
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False, None


def test_watch_history_endpoint(watch_alert_id: str = None):
    """Test GET /api/watch/history endpoint with various filters"""
    print_test_header("GET /api/watch/history - Get Watch History (with limit)")
    
    try:
        # Test 1: Get history with limit
        response = requests.get(
            f"{BACKEND_URL}/watch/history?limit=10",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Watch history endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse: JSON list with {len(data)} items")
            
            if isinstance(data, list):
                print_success(f"Response is a list")
                
                if len(data) > 0:
                    print_success(f"List contains {len(data)} alert(s)")
                    print(f"Sample item: {json.dumps(data[0], indent=2)}")
                    
                    # Check if the alert we just logged is in the list (should be newest first)
                    if watch_alert_id:
                        found = any(item.get("id") == watch_alert_id for item in data)
                        if found:
                            print_success(f"Found the alert we just logged (id: {watch_alert_id})")
                        else:
                            print_warning(f"Could not find the alert we just logged (id: {watch_alert_id})")
                else:
                    print_warning("List is empty (may be expected if no alerts logged yet)")
            else:
                print_error("Response is not a list")
                return False
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
        
        # Test 2: Filter by site and severity
        print_test_header("GET /api/watch/history - Filter by site and severity")
        
        response2 = requests.get(
            f"{BACKEND_URL}/watch/history?site=Warehouse%20Array%20%E2%80%93%20Hamburg%20Hafen&severity=critical",
            timeout=10
        )
        
        print(f"Status Code: {response2.status_code}")
        
        if response2.status_code == 200:
            print_success("Watch history with filters returned 200 status")
            
            data2 = response2.json()
            print(f"Response: JSON list with {len(data2)} items")
            
            if isinstance(data2, list):
                print_success(f"Response is a list (filtered)")
                
                # Validate that all items match the filter
                if len(data2) > 0:
                    all_match = True
                    for item in data2:
                        if item.get("site") != "Warehouse Array – Hamburg Hafen":
                            print_error(f"Item site does not match filter: {item.get('site')}")
                            all_match = False
                        if item.get("severity") != "critical":
                            print_error(f"Item severity does not match filter: {item.get('severity')}")
                            all_match = False
                    
                    if all_match:
                        print_success(f"All {len(data2)} items match the filter criteria")
                else:
                    print_warning("Filtered list is empty")
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"Expected 200, got {response2.status_code}")
            return False
        
        # Test 3: Search by keyword
        print_test_header("GET /api/watch/history - Search by keyword")
        
        response3 = requests.get(
            f"{BACKEND_URL}/watch/history?search=harness",
            timeout=10
        )
        
        print(f"Status Code: {response3.status_code}")
        
        if response3.status_code == 200:
            print_success("Watch history with search returned 200 status")
            
            data3 = response3.json()
            print(f"Response: JSON list with {len(data3)} items")
            
            if isinstance(data3, list):
                print_success(f"Response is a list (search results)")
                
                # Validate that all items contain the search keyword in alert
                if len(data3) > 0:
                    all_match = True
                    for item in data3:
                        if "harness" not in item.get("alert", "").lower():
                            print_error(f"Item alert does not contain 'harness': {item.get('alert')}")
                            all_match = False
                    
                    if all_match:
                        print_success(f"All {len(data3)} items contain 'harness' in alert")
                        print(f"Sample: {data3[0].get('alert')}")
                else:
                    print_warning("Search results are empty")
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"Expected 200, got {response3.status_code}")
            return False
        
        return True
        
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False


def test_hazards_create_endpoint(watch_alert_id: str = None):
    """Test POST /api/hazards endpoint with watch_alert_id linking"""
    print_test_header("POST /api/hazards - Create Hazard (linked to watch alert)")
    
    try:
        # Test data from review request
        test_data = {
            "site": "Warehouse Array – Hamburg Hafen",
            "hazard_type": "Worker without harness near unprotected edge",
            "severity": "critical",
            "description": "Auto-filed from watch alert",
            "snapshot_b64": "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQIW2NgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==",
            "source": "watch",
            "watch_alert_id": watch_alert_id
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        response = requests.post(
            f"{BACKEND_URL}/hazards",
            json=test_data,
            timeout=10
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Hazards create endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False, None
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            required_fields = ["id", "site", "hazard_type", "severity", "status", "reported_by", "description", "snapshot_b64", "source", "watch_alert_id", "timestamp"]
            all_fields_present = True
            
            for field in required_fields:
                if field in data:
                    print_success(f"Response contains '{field}' field")
                else:
                    print_error(f"Response missing '{field}' field")
                    all_fields_present = False
            
            if not all_fields_present:
                return False, None
            
            # Validate id is a UUID string
            if isinstance(data["id"], str) and len(data["id"]) > 0:
                print_success(f"'id' is a non-empty string (UUID): {data['id']}")
            else:
                print_error("'id' is not a valid UUID string")
                return False, None
            
            # Validate source is "watch"
            if data["source"] == "watch":
                print_success(f"'source' is 'watch' as expected")
            else:
                print_error(f"'source' should be 'watch', got: {data['source']}")
                return False, None
            
            # Validate watch_alert_id matches input
            if watch_alert_id and data["watch_alert_id"] == watch_alert_id:
                print_success(f"'watch_alert_id' matches input: {data['watch_alert_id']}")
            else:
                print_warning(f"'watch_alert_id' mismatch or not provided. Expected: {watch_alert_id}, Got: {data['watch_alert_id']}")
            
            # Return the hazard ID for verification
            return True, data["id"]
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False, None
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False, None


def test_watch_alert_linked_to_hazard(watch_alert_id: str, hazard_id: str):
    """Verify that the watch alert is now linked to the hazard"""
    print_test_header("Verify Watch Alert Linking - Check filed_as_hazard and hazard_id")
    
    try:
        # Get the watch history to find our alert
        response = requests.get(
            f"{BACKEND_URL}/watch/history?limit=100",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Watch history endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Find our watch alert
        watch_alert = None
        for item in data:
            if item.get("id") == watch_alert_id:
                watch_alert = item
                break
        
        if not watch_alert:
            print_error(f"Could not find watch alert with id: {watch_alert_id}")
            return False
        
        print(f"\nFound watch alert:")
        print(json.dumps(watch_alert, indent=2))
        
        # Verify filed_as_hazard is now True
        if watch_alert.get("filed_as_hazard") == True:
            print_success(f"'filed_as_hazard' is True (correctly updated)")
        else:
            print_error(f"'filed_as_hazard' should be True, got: {watch_alert.get('filed_as_hazard')}")
            return False
        
        # Verify hazard_id matches the hazard we created
        if watch_alert.get("hazard_id") == hazard_id:
            print_success(f"'hazard_id' matches the created hazard: {hazard_id}")
        else:
            print_error(f"'hazard_id' mismatch. Expected: {hazard_id}, Got: {watch_alert.get('hazard_id')}")
            return False
        
        return True
        
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False


def test_hazards_list_endpoint():
    """Test GET /api/hazards endpoint"""
    print_test_header("GET /api/hazards - List Hazards")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/hazards?limit=10",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Hazards list endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse: JSON list with {len(data)} items")
            
            if isinstance(data, list):
                print_success(f"Response is a list")
                
                if len(data) > 0:
                    print_success(f"List contains {len(data)} hazard(s)")
                    print(f"Sample item: {json.dumps(data[0], indent=2)}")
                    
                    # Check if any hazard has source="watch"
                    watch_hazards = [h for h in data if h.get("source") == "watch"]
                    if watch_hazards:
                        print_success(f"Found {len(watch_hazards)} hazard(s) with source='watch'")
                else:
                    print_warning("List is empty (may be expected if no hazards created yet)")
                
                return True
            else:
                print_error("Response is not a list")
                return False
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False


def test_watch_history_delete_endpoint():
    """Test DELETE /api/watch/history endpoint"""
    print_test_header("DELETE /api/watch/history - Clear Watch History")
    
    try:
        response = requests.delete(
            f"{BACKEND_URL}/watch/history",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Watch history delete endpoint returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        # Parse and validate response
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check for "deleted" field
            if "deleted" in data:
                print_success(f"Response contains 'deleted' field")
                
                deleted_count = data["deleted"]
                if isinstance(deleted_count, int) and deleted_count >= 1:
                    print_success(f"Deleted {deleted_count} alert(s)")
                else:
                    print_warning(f"Deleted count is {deleted_count} (may be 0 if no alerts existed)")
            else:
                print_error("Response missing 'deleted' field")
                return False
            
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {str(e)}")
            print(f"Response text: {response.text}")
            return False
        
        # Verify that GET history now returns empty
        print_test_header("Verify Watch History is Empty After Delete")
        
        verify_response = requests.get(
            f"{BACKEND_URL}/watch/history?limit=100",
            timeout=10
        )
        
        print(f"Status Code: {verify_response.status_code}")
        
        if verify_response.status_code == 200:
            print_success("Watch history endpoint returned 200 status")
            
            verify_data = verify_response.json()
            
            if isinstance(verify_data, list):
                if len(verify_data) == 0:
                    print_success("Watch history is now empty (as expected after delete)")
                    return True
                else:
                    print_error(f"Watch history should be empty but contains {len(verify_data)} items")
                    return False
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"Expected 200, got {verify_response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False


def test_agent_chat_gemini():
    """Test POST /api/agent/chat with Gemini provider"""
    print_test_header("POST /api/agent/chat - AI Agent Chat (Gemini Provider)")
    
    try:
        test_data = {
            "session_id": "gemini-chat-1",
            "message": "In one sentence, what PPE is essential for rooftop solar work?",
            "history": [],
            "model_provider": "gemini"
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/agent/chat",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        if response.status_code == 200:
            print_success("Agent chat with Gemini returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            if "reply" not in data or "session_id" not in data:
                print_error("Response missing required fields")
                return False
            
            print_success(f"Response contains required fields")
            
            # Validate reply is non-empty
            if isinstance(data["reply"], str) and len(data["reply"]) > 0:
                print_success(f"'reply' is a non-empty string ({len(data['reply'])} characters)")
                print(f"  Reply: {data['reply'][:200]}...")
                
                # Check if reply is contextually relevant
                ppe_keywords = ["ppe", "helmet", "harness", "gloves", "boots", "glasses", "vest", "protection", "safety", "fall"]
                reply_lower = data["reply"].lower()
                relevant = any(keyword in reply_lower for keyword in ppe_keywords)
                
                if relevant:
                    print_success("Reply appears contextually relevant to PPE question")
                else:
                    print_warning("Reply may not be contextually relevant to PPE question")
                
                return True
            else:
                print_error("'reply' is empty or not a string")
                return False
                
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


def test_swms_generate_gemini():
    """Test POST /api/swms/generate with Gemini provider"""
    print_test_header("POST /api/swms/generate - AI SWMS Generation (Gemini Provider)")
    
    try:
        test_data = {
            "site": "Villa – Grunewald",
            "job_type": "Rooftop PV Installation – 8kW Domestic",
            "notes": "Terracotta tile roof, 30 degree pitch",
            "model_provider": "gemini"
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/swms/generate",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        if response.status_code == 200:
            print_success("SWMS generation with Gemini returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
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
                if isinstance(data[field], list) and len(data[field]) > 0:
                    print_success(f"'{field}' is a non-empty list with {len(data[field])} items")
                    print(f"  Sample: {data[field][0]}")
                else:
                    print_error(f"'{field}' is empty or not a list")
                    all_lists_valid = False
            
            # Validate summary
            if isinstance(data["summary"], str) and len(data["summary"]) > 0:
                print_success(f"'summary' is a non-empty string ({len(data['summary'])} characters)")
                print(f"  Summary: {data['summary'][:150]}...")
            else:
                print_error("'summary' is empty or not a string")
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


def test_agent_chat_anthropic():
    """Test POST /api/agent/chat with Anthropic (Claude) provider"""
    print_test_header("POST /api/agent/chat - AI Agent Chat (Anthropic/Claude Provider)")
    
    try:
        test_data = {
            "session_id": "claude-1",
            "message": "What is lockout/tagout in one sentence?",
            "history": [],
            "model_provider": "anthropic"
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/agent/chat",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        if response.status_code == 200:
            print_success("Agent chat with Anthropic returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            if "reply" not in data or "session_id" not in data:
                print_error("Response missing required fields")
                return False
            
            print_success(f"Response contains required fields")
            
            # Validate reply is non-empty
            if isinstance(data["reply"], str) and len(data["reply"]) > 0:
                print_success(f"'reply' is a non-empty string ({len(data['reply'])} characters)")
                print(f"  Reply: {data['reply'][:200]}...")
                
                # Check if reply is contextually relevant
                loto_keywords = ["lockout", "tagout", "loto", "energy", "isolate", "equipment", "safety", "procedure"]
                reply_lower = data["reply"].lower()
                relevant = any(keyword in reply_lower for keyword in loto_keywords)
                
                if relevant:
                    print_success("Reply appears contextually relevant to lockout/tagout question")
                else:
                    print_warning("Reply may not be contextually relevant to lockout/tagout question")
                
                return True
            else:
                print_error("'reply' is empty or not a string")
                return False
                
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


def test_agent_chat_default_provider():
    """Test POST /api/agent/chat without model_provider (should default to OpenAI)"""
    print_test_header("POST /api/agent/chat - AI Agent Chat (Default Provider - OpenAI)")
    
    try:
        test_data = {
            "session_id": "default-1",
            "message": "Hello",
            "history": []
        }
        
        print(f"Request payload:")
        print(json.dumps(test_data, indent=2))
        
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_URL}/agent/chat",
            json=test_data,
            timeout=35
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        if response.status_code == 200:
            print_success("Agent chat with default provider returned 200 status")
        else:
            print_error(f"Expected 200, got {response.status_code}")
            print(f"Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"\nResponse structure:")
            print(json.dumps(data, indent=2))
            
            # Check required fields
            if "reply" not in data or "session_id" not in data:
                print_error("Response missing required fields")
                return False
            
            print_success(f"Response contains required fields")
            
            # Validate reply is non-empty
            if isinstance(data["reply"], str) and len(data["reply"]) > 0:
                print_success(f"'reply' is a non-empty string ({len(data['reply'])} characters)")
                print(f"  Reply: {data['reply'][:200]}...")
                return True
            else:
                print_error("'reply' is empty or not a string")
                return False
                
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
    
    # Test NEW Gemini model integration first
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}Testing NEW Gemini Model Integration{Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["POST /api/agent/chat (Gemini)"] = test_agent_chat_gemini()
    results["POST /api/swms/generate (Gemini)"] = test_swms_generate_gemini()
    results["POST /api/agent/chat (Anthropic)"] = test_agent_chat_anthropic()
    results["POST /api/agent/chat (Default OpenAI)"] = test_agent_chat_default_provider()
    
    # Test existing endpoints to confirm nothing broke
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}Testing Existing Endpoints (Regression Check){Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["GET /api/"] = test_root_endpoint()
    results["POST /api/hazards/from-voice"] = test_hazards_from_voice_endpoint()
    results["POST /api/risk/assess"] = test_risk_assess_endpoint()
    results["POST /api/risk/watch"] = test_risk_watch_endpoint()
    results["POST /api/watch/log"] = test_watch_log_endpoint()[0]
    results["GET /api/watch/history"] = test_watch_history_endpoint()
    results["POST /api/hazards"] = test_hazards_create_endpoint()[0]
    results["GET /api/hazards"] = test_hazards_list_endpoint()
    
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
