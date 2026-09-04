#!/usr/bin/env python3
"""
Backend API Testing Suite for SafePro SWMS Application
Tests all backend endpoints including the new AI SWMS generation endpoint.
"""

import requests
import json
import time
from typing import Dict, Any

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
