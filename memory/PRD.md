# Research Prep AI — Product Requirements Document

## Overview
Research Prep AI is a mobile (React Native / Expo) research assistant that guides students, PhD scholars, and faculty from an idea to a complete research package. Powered by Claude Sonnet 4.5 via the Emergent Universal Key.

## MVP Modules
1. **Topic Discovery** — Domain + keywords → 5 research topics with novelty/difficulty scores + suggested datasets.
2. **Research Gap Finder** — Topic + uploaded papers → existing-work summary, prioritized gaps, future scope.
3. **Literature Review Generator** — PDFs uploaded → summary, methodology, dataset, comparison matrix.
4. **Research Proposal Builder** — Title, Abstract, Problem Statement, Objectives, Scope, Methodology, Future Scope.
5. **Citation Generator** — IEEE, APA, MLA, Chicago.
6. **PPT Generator** — 10-slide deck with speaker notes.

Bonus: **AI Tutor (Stella)** — RAG-style chat over uploaded papers using keyword retrieval + Claude synthesis.

## Tech Stack
- Backend: FastAPI + MongoDB (motor) + emergentintegrations (Claude Sonnet 4.5) + PyMuPDF for PDF extraction.
- Auth: JWT email/password (PyJWT + bcrypt).
- Frontend: Expo Router, Ionicons, expo-blur (glass surfaces), react-native-svg for charts, expo-document-picker for PDFs.
- Style: "Aurora Glass Pastel" — soft pastel radial-gradient background, glass cards, Inter typography.

## Navigation
Bottom tabs (max 4): Home · Projects · Library · Profile. Modal presentations: New Project, Chat, Paste Paper.

## Storage Model (Mongo, string UUIDs)
- users, projects, research_topics, papers, paper_chunks, literature_reviews, research_gaps, proposals, presentations.

## Key API Endpoints (all under /api)
- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Projects: `GET/POST /projects`, `GET/DELETE /projects/{id}`
- Topics: `POST /topics/generate`, `GET /projects/{id}/topics`
- Papers: `POST /papers/upload`, `POST /papers/text`, `GET /projects/{id}/papers`, `DELETE /papers/{id}`
- Literature Review: `POST /literature-review`, `GET /projects/{id}/literature-review`
- Gaps: `POST /research-gap`, `GET /projects/{id}/research-gap`
- Proposal: `POST /proposal/generate`, `GET/PATCH /projects/{id}/proposal`
- Citations: `POST /citations/generate`
- PPT: `POST /ppt/generate`, `GET /projects/{id}/ppt`
- Chat (RAG): `POST /chat`
- Dashboard: `GET /dashboard/stats`

## RAG Approach
PyMuPDF extracts text → chunked (1200 chars, 150 overlap) → stored in `paper_chunks`. Retrieval uses keyword-overlap scoring (token frequency), top-k chunks fed to Claude as context. Lightweight, no external vector DB required.

## Test Credentials
See `/app/memory/test_credentials.md`.
