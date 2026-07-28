"""
Backend tests for Razorpay Subscriptions integration + feature-gating.
Covers /api/billing/{plans,status,subscription,cancel,webhook} and
enforcement of require_quota() on topics/generate & ppt/generate.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://research-prep-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
LLM_TIMEOUT = 90


# ---------- Fresh isolated user for quota tests ----------
@pytest.fixture(scope="module")
def fresh_user():
    ts = int(time.time())
    email = f"billing_test_{ts}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Billing Tester", "email": email, "password": "pass1234", "role": "student"
    }, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "token": data["token"], "id": data["user"]["id"]}


@pytest.fixture(scope="module")
def fresh_headers(fresh_user):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {fresh_user['token']}"}


@pytest.fixture(scope="module")
def fresh_project(fresh_headers):
    r = requests.post(f"{API}/projects", json={
        "title": "TEST_Billing Project",
        "domain": "Machine Learning",
        "description": "quota gating tests",
        "keywords": "quota, billing"
    }, headers=fresh_headers, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    try:
        requests.delete(f"{API}/projects/{pid}", headers=fresh_headers, timeout=20)
    except Exception:
        pass


# ---------- /api/billing/plans ----------
class TestPlansCatalog:
    def test_plans_no_auth_required(self):
        r = requests.get(f"{API}/billing/plans", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("currency") == "INR"
        plans = data.get("plans", [])
        assert isinstance(plans, list) and len(plans) == 3
        tiers = {p["tier"]: p for p in plans}
        assert set(tiers.keys()) == {"free", "student", "pro"}

    def test_plans_amount_paise_correct(self):
        r = requests.get(f"{API}/billing/plans", timeout=20)
        tiers = {p["tier"]: p for p in r.json()["plans"]}
        assert tiers["free"]["amount_paise"] == 0
        assert tiers["student"]["amount_paise"] == 74900
        assert tiers["pro"]["amount_paise"] == 239900

    def test_plans_features_populated(self):
        r = requests.get(f"{API}/billing/plans", timeout=20)
        for p in r.json()["plans"]:
            assert isinstance(p["features"], list) and len(p["features"]) >= 1
            assert p["amount_display"].startswith("₹")


# ---------- /api/billing/status ----------
class TestBillingStatus:
    def test_status_requires_auth(self):
        r = requests.get(f"{API}/billing/status", timeout=20)
        assert r.status_code == 401

    def test_status_fresh_user_is_free(self, fresh_headers):
        r = requests.get(f"{API}/billing/status", headers=fresh_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("tier") == "free"
        assert data.get("status") == "free"
        assert data.get("subscription_id") is None
        assert data.get("cancel_at_period_end") is False


# ---------- /api/billing/subscription (placeholder keys → 503) ----------
class TestBillingSubscription:
    def test_subscription_requires_auth(self):
        r = requests.post(f"{API}/billing/subscription", json={"tier": "student"}, timeout=20)
        assert r.status_code == 401

    def test_subscription_returns_503_with_placeholder_keys(self, fresh_headers):
        r = requests.post(f"{API}/billing/subscription", json={"tier": "student"},
                          headers=fresh_headers, timeout=30)
        assert r.status_code == 503, r.text
        detail = (r.json() or {}).get("detail", "")
        assert "not configured" in detail.lower(), f"detail should mention 'not configured': {detail}"

    def test_subscription_pro_tier_also_503(self, fresh_headers):
        r = requests.post(f"{API}/billing/subscription", json={"tier": "pro"},
                          headers=fresh_headers, timeout=30)
        assert r.status_code == 503

    def test_subscription_invalid_tier_422(self, fresh_headers):
        r = requests.post(f"{API}/billing/subscription", json={"tier": "enterprise"},
                          headers=fresh_headers, timeout=20)
        assert r.status_code == 422  # pydantic pattern rejection


# ---------- /api/billing/cancel ----------
class TestBillingCancel:
    def test_cancel_requires_auth(self):
        r = requests.post(f"{API}/billing/cancel", json={"cancel_at_period_end": False}, timeout=20)
        assert r.status_code == 401

    def test_cancel_no_subscription_404(self, fresh_headers):
        r = requests.post(f"{API}/billing/cancel", json={"cancel_at_period_end": False},
                          headers=fresh_headers, timeout=20)
        assert r.status_code == 404, r.text
        assert "no active subscription" in r.json()["detail"].lower()


# ---------- /api/billing/webhook ----------
class TestBillingWebhook:
    def test_webhook_missing_signature_header(self):
        # No signature header -> should be 503 (secret is placeholder). The 503 check
        # comes before signature check, so with placeholder secret we get 503.
        r = requests.post(f"{API}/billing/webhook", json={"event": "subscription.activated"}, timeout=20)
        assert r.status_code == 503, r.text
        assert "webhook secret" in r.json()["detail"].lower() or "not configured" in r.json()["detail"].lower()

    def test_webhook_with_signature_still_503_due_to_placeholder_secret(self):
        r = requests.post(f"{API}/billing/webhook",
                          json={"event": "subscription.activated"},
                          headers={"X-Razorpay-Signature": "somesig"},
                          timeout=20)
        assert r.status_code == 503


# ---------- Feature gating: topics/generate (free = 5/day) ----------
class TestFeatureGatingTopics:
    def test_sixth_call_returns_402_quota_exceeded(self, fresh_headers, fresh_project):
        # Do 5 calls that should succeed, then a 6th that must be blocked.
        # Each call is an LLM call so this is slow - keep prompt minimal.
        successes = 0
        for i in range(5):
            r = requests.post(f"{API}/topics/generate", json={
                "project_id": fresh_project,
                "domain": "ML",
                "keywords": "x",
                "interest": f"call{i}"
            }, headers=fresh_headers, timeout=LLM_TIMEOUT)
            assert r.status_code == 200, f"call {i+1} failed: {r.status_code} {r.text}"
            successes += 1
        assert successes == 5

        # 6th call must be blocked
        r6 = requests.post(f"{API}/topics/generate", json={
            "project_id": fresh_project, "domain": "ML", "keywords": "x", "interest": "call6"
        }, headers=fresh_headers, timeout=LLM_TIMEOUT)
        assert r6.status_code == 402, f"expected 402 on 6th call, got {r6.status_code}: {r6.text}"
        detail = r6.json().get("detail", {})
        assert isinstance(detail, dict), f"detail must be a dict: {detail}"
        assert detail.get("error") == "quota_exceeded"
        assert detail.get("feature") == "topic_gens_day"
        assert detail.get("tier") == "free"
        assert detail.get("limit") == 5

    def test_usage_document_recorded(self, fresh_user):
        # After the 5 successful topic gens, db.usage should have a matching doc.
        # We inspect via mongodb directly since there is no admin endpoint.
        import os
        from pymongo import MongoClient
        from datetime import datetime, timezone
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "research_prep_ai")
        c = MongoClient(mongo_url)
        db = c[db_name]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc = db.usage.find_one({"user_id": fresh_user["id"], "feature": "topic_gens_day", "window": today})
        assert doc is not None, "usage doc missing for topic_gens_day"
        assert doc.get("count", 0) >= 5


# ---------- Feature gating: ppt/generate (free = 0 → upgrade_required) ----------
class TestFeatureGatingPPT:
    def test_ppt_generate_free_tier_402_upgrade_required(self, fresh_headers, fresh_project):
        r = requests.post(f"{API}/ppt/generate", json={"project_id": fresh_project},
                          headers=fresh_headers, timeout=30)
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", {})
        assert isinstance(detail, dict)
        assert detail.get("error") == "upgrade_required"
        assert detail.get("feature") == "ppt_unlock"
