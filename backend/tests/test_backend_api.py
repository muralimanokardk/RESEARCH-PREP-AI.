"""
Backend regression tests for Research Prep AI
Covers: health, auth, projects, topics, papers (text+pdf), literature review,
research gap, proposal, citations, ppt, chat (RAG), dashboard stats, authorization.
"""
import base64
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://research-prep-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
LLM_TIMEOUT = 90  # Claude Sonnet 4.5 can take 5-30s per call


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "Research Prep AI"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "elena@test.com", "password": "pass1234"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == "elena@test.com"
        assert data["user"]["role"] == "student"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "elena@test.com", "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_with_bad_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer notavalidtoken"}, timeout=20)
        assert r.status_code == 401

    def test_me_success(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "elena@test.com"
        assert "id" in data

    def test_register_duplicate_email(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "Elena", "email": "elena@test.com", "password": "pass1234", "role": "student"
        }, timeout=30)
        assert r.status_code == 400


# ---------- Projects CRUD ----------
class TestProjects:
    def test_list_projects_authorized(self, session, auth_headers):
        r = session.get(f"{API}/projects", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_projects_unauthorized(self, session):
        r = session.get(f"{API}/projects", timeout=20)
        assert r.status_code == 401

    def test_get_project_by_id(self, session, auth_headers, project_id):
        r = session.get(f"{API}/projects/{project_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == project_id
        assert r.json()["domain"] == "Machine Learning"

    def test_get_nonexistent_project(self, session, auth_headers):
        r = session.get(f"{API}/projects/nonexistent-project-id-xyz", headers=auth_headers, timeout=20)
        assert r.status_code == 404

    def test_create_and_delete_project(self, session, auth_headers):
        r = session.post(f"{API}/projects", json={
            "title": "TEST_Ephemeral", "domain": "NLP", "description": "delete me"
        }, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        pid = r.json()["id"]
        # Verify persistence via GET
        r2 = session.get(f"{API}/projects/{pid}", headers=auth_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["title"] == "TEST_Ephemeral"
        # Delete
        r3 = session.delete(f"{API}/projects/{pid}", headers=auth_headers, timeout=20)
        assert r3.status_code == 200
        assert r3.json()["deleted"] == 1
        # Verify gone
        r4 = session.get(f"{API}/projects/{pid}", headers=auth_headers, timeout=20)
        assert r4.status_code == 404


# ---------- Project isolation between users ----------
class TestProjectIsolation:
    def test_user_b_cannot_access_user_a_project(self, session, project_id):
        # Register user B
        email = f"userb_{int(time.time())}@test.com"
        r = session.post(f"{API}/auth/register", json={
            "name": "UserB", "email": email, "password": "pass1234", "role": "student"
        }, timeout=30)
        assert r.status_code == 200
        tokenB = r.json()["token"]
        hB = {"Content-Type": "application/json", "Authorization": f"Bearer {tokenB}"}
        # Try to access user A's project
        r2 = session.get(f"{API}/projects/{project_id}", headers=hB, timeout=20)
        assert r2.status_code == 404


# ---------- Topics ----------
class TestTopics:
    def test_generate_topics(self, session, auth_headers, project_id):
        r = session.post(f"{API}/topics/generate", json={
            "project_id": project_id,
            "domain": "Machine Learning",
            "keywords": "transformers, few-shot learning",
            "interest": "efficient fine-tuning for low-resource languages"
        }, headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        topics = r.json()
        assert isinstance(topics, list)
        assert len(topics) == 5, f"Expected 5 topics, got {len(topics)}"
        for t in topics:
            assert "topic_name" in t and t["topic_name"]
            assert isinstance(t["novelty_score"], int) and 0 <= t["novelty_score"] <= 100
            assert isinstance(t["difficulty_score"], int) and 0 <= t["difficulty_score"] <= 100
            assert isinstance(t["datasets"], list)
            assert "description" in t and t["description"]

    def test_list_topics(self, session, auth_headers, project_id):
        r = session.get(f"{API}/projects/{project_id}/topics", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 5


# ---------- Papers ----------
SAMPLE_PAPER_TEXT = (
    "Abstract: This paper introduces LoRA, a low-rank adaptation technique for large language models. "
    "We freeze the pretrained weights and inject trainable rank decomposition matrices into each transformer layer. "
    "We evaluate on GLUE benchmark using RoBERTa-large and demonstrate 10000x reduction in trainable parameters "
    "while achieving comparable performance to full fine-tuning. Methodology: Low-rank matrices are added in parallel "
    "to attention weights. Dataset: We use GLUE (MNLI, SST-2, MRPC). Results: LoRA matches full fine-tuning on GLUE "
    "with only 0.5% of parameters trained, reducing GPU memory by 3x."
)

@pytest.fixture(scope="module")
def paper_ids(session, auth_headers, project_id):
    """Create one paper via text so downstream tests (lit review, gap, proposal) have data."""
    r = session.post(f"{API}/papers/text", json={
        "project_id": project_id,
        "title": "TEST_LoRA: Low-Rank Adaptation of Large Language Models",
        "authors": "Edward Hu et al.",
        "year": 2021,
        "text_content": SAMPLE_PAPER_TEXT
    }, headers=auth_headers, timeout=LLM_TIMEOUT)
    assert r.status_code == 200, r.text
    paper = r.json()
    assert paper["title"].startswith("TEST_LoRA")
    assert paper["summary"], "summary should be filled by Claude"
    assert paper["methodology"], "methodology should be filled"
    return [paper["id"]]


def _make_minimal_pdf_base64() -> str:
    """Generate a minimal in-memory PDF with meaningful text using PyMuPDF (fitz)."""
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    txt = (
        "Title: TEST_Attention Is All You Need\n"
        "Authors: Ashish Vaswani et al.\n"
        "Year: 2017\n\n"
        "Abstract: We propose a new simple network architecture, the Transformer, "
        "based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.\n\n"
        "Methodology: Multi-head self-attention with positional encodings.\n"
        "Dataset: WMT 2014 English-to-German translation (4.5M sentence pairs).\n"
        "Results: Achieves 28.4 BLEU on WMT 2014 En-De, a new state-of-the-art."
    )
    page.insert_text((72, 72), txt, fontsize=11)
    buf = doc.tobytes()
    doc.close()
    return base64.b64encode(buf).decode()


class TestPapers:
    def test_paper_from_text_persisted(self, session, auth_headers, project_id, paper_ids):
        # paper_ids fixture already created it; verify it appears in list
        r = session.get(f"{API}/projects/{project_id}/papers", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        titles = [p["title"] for p in r.json()]
        assert any("TEST_LoRA" in t for t in titles)

    def test_paper_upload_pdf(self, session, auth_headers, project_id):
        pdf_b64 = _make_minimal_pdf_base64()
        r = session.post(f"{API}/papers/upload", json={
            "project_id": project_id,
            "filename": "TEST_attention.pdf",
            "base64_data": pdf_b64
        }, headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        paper = r.json()
        assert paper["summary"], "summary should be filled by Claude"
        assert paper["methodology"], "methodology should be filled"

    def test_paper_text_too_short(self, session, auth_headers, project_id):
        r = session.post(f"{API}/papers/text", json={
            "project_id": project_id, "title": "TEST_Short", "text_content": "abc"
        }, headers=auth_headers, timeout=30)
        assert r.status_code == 400


# ---------- Literature Review ----------
class TestLiteratureReview:
    def test_generate_literature_review(self, session, auth_headers, project_id, paper_ids):
        r = session.post(f"{API}/literature-review", json={"project_id": project_id},
                         headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["synthesis"], "synthesis should be non-empty"
        assert isinstance(data["matrix"], list) and len(data["matrix"]) >= 1
        for row in data["matrix"]:
            assert "paper_title" in row

    def test_get_stored_literature_review(self, session, auth_headers, project_id):
        r = session.get(f"{API}/projects/{project_id}/literature-review",
                        headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["synthesis"], "should return previously stored synthesis"


# ---------- Research Gap ----------
class TestResearchGap:
    def test_research_gap(self, session, auth_headers, project_id, paper_ids):
        r = session.post(f"{API}/research-gap", json={"project_id": project_id},
                         headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["existing_work_summary"]
        assert isinstance(data["gaps"], list) and len(data["gaps"]) >= 1
        assert isinstance(data["future_scope"], list) and len(data["future_scope"]) >= 1


# ---------- Proposal ----------
class TestProposal:
    def test_generate_proposal(self, session, auth_headers, project_id, paper_ids):
        r = session.post(f"{API}/proposal/generate", json={
            "project_id": project_id,
            "selected_topic": "Parameter-efficient fine-tuning for low-resource languages"
        }, headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        p = r.json()
        for key in ["title", "abstract", "problem_statement", "scope", "methodology", "future_scope"]:
            assert p[key], f"{key} should be non-empty"
        assert isinstance(p["objectives"], list) and len(p["objectives"]) >= 1

    def test_get_and_patch_proposal(self, session, auth_headers, project_id):
        r = session.get(f"{API}/projects/{project_id}/proposal", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json() is not None
        # patch title
        r2 = session.patch(f"{API}/projects/{project_id}/proposal", json={"title": "TEST_Patched Title"},
                           headers=auth_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["title"] == "TEST_Patched Title"


# ---------- Citations ----------
class TestCitations:
    @pytest.mark.parametrize("style", ["IEEE", "APA", "MLA", "Chicago"])
    def test_citations_all_styles(self, session, auth_headers, project_id, paper_ids, style):
        r = session.post(f"{API}/citations/generate", json={
            "project_id": project_id, "style": style
        }, headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["style"].upper() == style.upper()
        assert isinstance(data["citations"], list) and len(data["citations"]) >= 1

    def test_citations_invalid_style(self, session, auth_headers, project_id, paper_ids):
        r = session.post(f"{API}/citations/generate", json={
            "project_id": project_id, "style": "BOGUS"
        }, headers=auth_headers, timeout=30)
        assert r.status_code == 400


# ---------- PPT ----------
class TestPPT:
    def test_generate_ppt_free_tier_paywalled(self, session, auth_headers, project_id, paper_ids):
        """After Razorpay integration, PPT generation is Pro-only. Free tier must get 402."""
        r = session.post(f"{API}/ppt/generate", json={"project_id": project_id},
                         headers=auth_headers, timeout=30)
        assert r.status_code == 402, r.text
        detail = r.json().get("detail", {})
        assert isinstance(detail, dict)
        assert detail.get("error") == "upgrade_required"
        assert detail.get("feature") == "ppt_unlock"


# ---------- AI Chat (RAG) ----------
class TestChat:
    def test_chat_uses_context(self, session, auth_headers, project_id, paper_ids):
        r = session.post(f"{API}/chat", json={
            "project_id": project_id,
            "question": "What is LoRA and how does it reduce trainable parameters?"
        }, headers=auth_headers, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "answer" in data and data["answer"]
        assert data["used_context"] is True, "RAG should retrieve LoRA chunks"


# ---------- Dashboard Stats ----------
class TestDashboard:
    def test_dashboard_stats(self, session, auth_headers):
        r = session.get(f"{API}/dashboard/stats", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ["projects", "papers", "topics", "proposals"]:
            assert k in data and isinstance(data[k], int)
        assert isinstance(data["activity"], list) and len(data["activity"]) == 4
        assert isinstance(data["mastery"], list) and len(data["mastery"]) >= 1


# ---------- Authorization (protected endpoints reject missing bearer) ----------
class TestAuthorization:
    @pytest.mark.parametrize("method,path,body", [
        ("GET", "/projects", None),
        ("POST", "/projects", {"title": "x", "domain": "y"}),
        ("POST", "/topics/generate", {"project_id": "x"}),
        ("POST", "/papers/text", {"project_id": "x", "title": "t", "text_content": "x"*100}),
        ("POST", "/literature-review", {"project_id": "x"}),
        ("POST", "/research-gap", {"project_id": "x"}),
        ("POST", "/proposal/generate", {"project_id": "x"}),
        ("POST", "/citations/generate", {"project_id": "x", "style": "IEEE"}),
        ("POST", "/ppt/generate", {"project_id": "x"}),
        ("POST", "/chat", {"project_id": "x", "question": "hi"}),
        ("GET", "/dashboard/stats", None),
        ("GET", "/auth/me", None),
    ])
    def test_requires_auth(self, session, method, path, body):
        url = f"{API}{path}"
        if method == "GET":
            r = session.get(url, timeout=20)
        else:
            r = session.post(url, json=body, timeout=20)
        assert r.status_code == 401, f"{method} {path} returned {r.status_code}, expected 401"
