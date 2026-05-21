"""Tests for Google Calendar OAuth login URL generation."""
import os
import urllib.parse as up
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@nat2go.com"
ADMIN_PASSWORD = "admin"


@pytest.fixture
def auth_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


class TestGoogleAuth:
    def test_google_login_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/google/login", timeout=15)
        assert r.status_code == 401

    def test_google_login_returns_valid_authorization_url(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/google/login", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "authorization_url" in data
        url = data["authorization_url"]
        assert url.startswith("https://accounts.google.com/o/oauth2/auth")
        parsed = up.urlparse(url)
        qs = dict(up.parse_qsl(parsed.query))
        # Validate the new client id is being used
        assert qs.get("client_id") == (
            "125832178684-vg818ao2hs3aculr5his1korn0gan9r8.apps.googleusercontent.com"
        )
        assert qs.get("response_type") == "code"
        assert "calendar.readonly" in qs.get("scope", "")
        assert qs.get("state") == ADMIN_EMAIL
        assert "redirect_uri" in qs
        assert qs.get("code_challenge_method") == "S256"

    def test_authorization_url_not_returning_credentials_missing_error(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/google/login", timeout=15)
        assert r.status_code != 400
        assert "Google credentials not configured" not in r.text
