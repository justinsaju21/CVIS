# CVIS Documentation

Welcome to the documentation for the Connected Vehicle Intelligence System (CVIS). The documentation is divided into 5 logical chapters to help you navigate from setup to academic grading.

## [01. Getting Started](./01-getting-started/)
Guides for setting up, configuring, and demonstrating the system.
- `01-installation-guide.md` — Dependencies and local environment setup.
- `02-deployment-guide.md` — Guide for deploying to the Debian homeserver (PM2, Cloudflare Tunnel).
- `03-user-manual.md` — Guide to using the Driver, NOC, and Admin frontend views.
- `04-demo-script.md` — Step-by-step script for live project demonstrations.

## [02. Architecture & API](./02-architecture-and-api/)
Technical details of how the system is constructed.
- `01-architecture-diagrams.md` — High-level diagrams of the 3-tier architecture.
- `02-system-workflow.md` — Detailed step-by-step data flow from the ESP8266 to the frontend.
- `03-api-reference.md` — REST endpoints, WebSocket events, and JSON schemas.
- `04-distributed-architecture.md` — Notes on scaling the system beyond the prototype.

## [03. Analysis & Theory](./03-analysis-and-theory/)
Deep-dives into security, performance, and conceptual design.
- `01-security-analysis.md` — Detailed breakdown of HMAC-SHA256, AES-GCM, and Replay Protection.
- `02-performance-analysis.md` — Latency metrics for telemetry ingest and AI inference.
- `03-theory-guide.md` — The academic theory behind the system design.
- `04-future-enhancements.md` — Planned features beyond Phase 8.

## [04. Academic Materials](./04-academic-materials/)
Documents specifically required for university submissions and evaluation.
- `01-ieee-report.md` — The formal, IEEE-formatted project report.
- `02-presentation-content.md` — Slide-by-slide outline for the PowerPoint presentation.
- `03-viva-qa.md` — Anticipated questions and detailed answers for the Viva Voce.
- `04-ccns-mapping.md` — Maps every feature to the CCNS syllabus learning outcomes.
- `05-business-model.md` — Commercial justification for centralised AI.
- `latex/` — LaTeX source files for the compiled PDF reports.

## [05. Project Management](./05-project-management/)
Logs and test plans showing how the project was built.
- `01-build-plan.md` — The 8-phase execution schedule and checklist.
- `02-testing-documentation.md` — Test cases for smoke, auth, AI, and end-to-end matrix testing.
