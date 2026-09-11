# USP Analysis (2026-09-11)

What CashGuard AI genuinely offers relative to the two nearest reference
categories — commercial AML/fraud-monitoring SaaS and India's government
cybercrime-reporting infrastructure — based on the research in
[`FRONTEND_RESEARCH_AND_GAPS.md`](./FRONTEND_RESEARCH_AND_GAPS.md). Every
claim below is grounded in something verified in this repo
([`PROJECT_STATUS_AND_GAPS.md`](./PROJECT_STATUS_AND_GAPS.md),
[`AML_FEATURE_REPORT.md`](./AML_FEATURE_REPORT.md)), not aspirational
marketing language.

## The gap CashGuard AI sits in

- **Commercial AML SaaS** (ComplyAdvantage, Chainalysis, SEON, etc.) is
  transaction-monitoring and compliance-workflow focused. It does not do
  cybercrime hotspot prediction, geospatial clustering of physical
  incidents (ATM fraud, cash withdrawal fraud), or fraud-ring network
  analysis tied to location data.
- **Government cybercrime portals** (NCRP, CFCFRMS, CCTNS) are
  reporting/case-tracking systems: they intake citizen complaints and
  track status. They have no predictive ML, no transaction-level risk
  scoring, and no real-time analyst dashboard — they are administrative
  systems, not analytical ones.
- CashGuard AI sits between these two categories: it combines
  **transaction-level AML detection** (the commercial-SaaS domain) with
  **geospatial cybercrime hotspot prediction and fraud-ring graph
  analysis** (a domain neither reference category covers), in a single
  real-time system.

## USP 1 — A genuinely trained detection model, not a rules engine or a mockup

Most SIH-style prototypes in this space present rule-based flagging or
untrained/synthetic-only demos. CashGuard AI has a **verified, trained
XGBoost model** on the real IBM AML transaction dataset — model artifacts
(`xgboost_aml.pkl`) exist on disk with measured metrics (ROC-AUC ~0.98,
recall ~90%) reported honestly in `AML_FEATURE_REPORT.md`, including its
precision limitation (see `FEASIBILITY_ANALYSIS.md`). This is a real,
testable ML pipeline (175 backend tests passing against it), not a
demo-only stub.

## USP 2 — Geospatial + transactional in one dashboard

Commercial AML tools score transactions; they don't map them. CashGuard
AI's `analytics` and `dashboard` pages combine the AML transaction panel
with a live Leaflet-based predictive map (heatmap, hotspot clustering via
`ml/kmeans_hotspot.py`, geofence zones). For a law-enforcement user, seeing
*where* risk concentrates alongside *which transactions* triggered it is
a combination none of the researched commercial tools or government
portals offer together.

## USP 3 — Real-time operational dashboard, not a batch report

NCRP/CFCFRMS are report-and-track systems — a complaint is filed and
status is polled later. CashGuard AI has a live WebSocket feed
(`/ws/live-feed`, `services/websocket_manager.py`) pushing alerts to
analysts as they happen, tested (`test_websocket_manager.py`) and wired
into the frontend alert center. This is an operational tool for active
monitoring, not an after-the-fact reporting system.

## USP 4 — Explainability built into the pipeline, not bolted on

SHAP-based explainability (`ml/shap_explainer.py`) exists in the backend
ML pipeline itself, alongside a feature-importance-radar frontend
component — consistent with where the commercial AML SaaS category is
heading in 2026 (per the researched vendor roundups) but ahead of where
government portals are (no ML at all). Note: per
`FRONTEND_RESEARCH_AND_GAPS.md`, full end-to-end wiring of this to the
live analyst view is a near-term gap, not yet a finished USP — flagged
honestly rather than overclaimed.

## USP 5 — Open, self-hostable, verifiably tested stack

The entire stack (FastAPI + Next.js + Postgres + Redis + Docker Compose)
is open and self-hostable, with 175+54+63 passing tests across
backend/frontend/MCP server (verified in `PROJECT_STATUS_AND_GAPS.md`) and
a working CI pipeline. Commercial AML SaaS is closed-source and
subscription-gated; government portals are closed government
infrastructure. A government agency or bank evaluating this can actually
run it, read it, and test it end-to-end — a meaningfully different
adoption story than either reference category.

## What CashGuard AI deliberately does not try to be

Being honest about scope keeps the USP list above credible:

- **Not a citizen-facing complaint intake portal.** No public reporting
  form or chatbot (like NCRP's Vani/CyberDost) exists or is planned — this
  is an analyst/LEA-facing detection tool, not a public-facing service.
- **Not a regulatory-compliance/KYC product.** No sanctions-list
  screening, no customer due-diligence workflow, no regulatory-update
  tracking — CashGuard AI detects and visualizes risk; it doesn't manage
  compliance obligations the way ComplyAdvantage or SEON do.
- **Not integrated with real banking/payment rails.** There is no fund-freeze
  or bank-API integration (unlike CFCFRMS's 85-institution backend) — see
  `FEASIBILITY_ANALYSIS.md` for what that would actually require.

## Bottom line

The defensible USP is narrow and real: **a trained, tested, transaction-plus-geospatial
AML/cybercrime detection dashboard with real-time alerting**, positioned
between transaction-only commercial tools and ML-free government reporting
systems — not a broader claim to replace either category.

See also: [`FRONTEND_RESEARCH_AND_GAPS.md`](./FRONTEND_RESEARCH_AND_GAPS.md),
[`FEASIBILITY_ANALYSIS.md`](./FEASIBILITY_ANALYSIS.md).
