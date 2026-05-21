"""Backend API tests for Nat2Go Studio OS"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://studio-minimal-15.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@nat2go.com"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    # cookies set
    assert "access_token" in session.cookies
    return session


# --- Auth tests ---
class TestAuth:
    def test_login_invalid(self, session):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_login_success_and_me(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# --- CRUD smoke tests ---
class TestCRUD:
    def test_tasks_empty_list(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/tasks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_get_delete_task(self, auth_session):
        payload = {"title": "TEST_task", "category": "priority", "completed": False}
        r = auth_session.post(f"{BASE_URL}/api/tasks", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "TEST_task"
        assert "id" in data
        tid = data["id"]
        # GET and verify
        r2 = auth_session.get(f"{BASE_URL}/api/tasks")
        assert any(t["id"] == tid for t in r2.json())
        # Delete
        r3 = auth_session.delete(f"{BASE_URL}/api/tasks/{tid}")
        assert r3.status_code == 200

    def test_clients_list(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_content_list(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/content")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_tasks_list(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/admin_tasks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_calendar_events_mocked(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/calendar/events")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestLogout:
    def test_logout(self, auth_session):
        r = auth_session.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
