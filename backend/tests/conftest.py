import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://research-prep-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

@pytest.fixture(scope="session")
def api_base():
    return API

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="session")
def auth_token(session):
    # Try login with seeded creds, register if login fails
    r = session.post(f"{API}/auth/login", json={"email": "elena@test.com", "password": "pass1234"}, timeout=30)
    if r.status_code != 200:
        r = session.post(f"{API}/auth/register", json={
            "name": "Elena", "email": "elena@test.com", "password": "pass1234", "role": "student"
        }, timeout=30)
    assert r.status_code == 200, f"Login/register failed: {r.status_code} {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"}

@pytest.fixture(scope="session")
def project_id(session, auth_headers):
    payload = {
        "title": "TEST_Backend Suite Project",
        "domain": "Machine Learning",
        "description": "Automated test project for backend regression",
        "keywords": "transformers, nlp, few-shot"
    }
    r = session.post(f"{API}/projects", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    # teardown
    try:
        session.delete(f"{API}/projects/{pid}", headers=auth_headers, timeout=30)
    except Exception:
        pass
