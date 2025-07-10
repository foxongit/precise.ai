#!/usr/bin/env python3
"""
Health check script for the RAG API
"""

import requests
import sys
import json
from datetime import datetime

def check_health(base_url="http://localhost:8000"):
    """Check if the API is healthy"""
    try:
        # Check health endpoint
        response = requests.get(f"{base_url}/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API Health Check PASSED")
            print(f"   Status: {data.get('status', 'unknown')}")
            print(f"   Timestamp: {data.get('timestamp', 'unknown')}")
            return True
        else:
            print(f"❌ API Health Check FAILED")
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ API Health Check FAILED")
        print("   Error: Cannot connect to API server")
        print(f"   URL: {base_url}")
        return False
    except requests.exceptions.Timeout:
        print("❌ API Health Check FAILED")
        print("   Error: Request timeout")
        return False
    except Exception as e:
        print("❌ API Health Check FAILED")
        print(f"   Error: {str(e)}")
        return False

def check_endpoints(base_url="http://localhost:8000"):
    """Check if main endpoints are accessible"""
    endpoints = [
        "/",
        "/health",
        "/docs",
        "/openapi.json"
    ]
    
    print("\n🔍 Checking API Endpoints:")
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                print(f"   ✅ {endpoint}")
            else:
                print(f"   ❌ {endpoint} (Status: {response.status_code})")
        except Exception as e:
            print(f"   ❌ {endpoint} (Error: {str(e)})")

if __name__ == "__main__":
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    print(f"🏥 RAG API Health Check")
    print(f"   Target: {base_url}")
    print(f"   Time: {datetime.now().isoformat()}")
    print("-" * 50)
    
    is_healthy = check_health(base_url)
    check_endpoints(base_url)
    
    print("-" * 50)
    if is_healthy:
        print("✅ Overall Status: HEALTHY")
        sys.exit(0)
    else:
        print("❌ Overall Status: UNHEALTHY")
        sys.exit(1)
