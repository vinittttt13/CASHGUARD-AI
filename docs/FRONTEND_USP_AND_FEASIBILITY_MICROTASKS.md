# Frontend USP & Feasibility Implementation Microtasks (2026-09-11)

> **Context**: Derived from [`FRONTEND_RESEARCH_AND_GAPS.md`](./FRONTEND_RESEARCH_AND_GAPS.md), [`USP_ANALYSIS.md`](./USP_ANALYSIS.md), and [`FEASIBILITY_ANALYSIS.md`](./FEASIBILITY_ANALYSIS.md).  
> **Goal**: Bridge the gap between commercial AML SaaS / Indian LEA infrastructure benchmarks and CashGuard AI's frontend, turning researched USPs into verified, working UI capabilities.  
> **Rule**: Every microtask must specify exact files, target endpoints, acceptance criteria, and verification commands.

---

## 📋 Microtask Roadmap Overview

| Phase | Focus Area | Tasks | Est. Effort | Priority |
|---|---|---|:---:|:---:|
| **Phase 1** | **High-Value Quick Wins (Backend-Ready Wiring)** | Tasks 1.1 – 1.4 | ~2-3 hrs | **P0 (Critical)** |
| **Phase 2** | **Core USP & Explainability (XAI + Triage)** | Tasks 2.1 – 2.3 | ~3-4 hrs | **P0 (Critical)** |
| **Phase 3** | **LEA Domain Adaptation & Legal Notice (SIH USP)** | Tasks 3.1 – 3.3 | ~2-3 hrs | **P1 (High)** |
| **Phase 4** | **Repository Hygiene, Polish & Test Automation** | Tasks 4.1 – 4.3 | ~2 hrs | **P1 (High)** |

---

## 🎯 Phase 1: High-Value Quick Wins (Backend-Ready Wiring)

### Microtask 1.1 — Intelligence & Dossier Report Export Action
- **Context**: Backend already implements `GET /api/v1/intelligence/report` and `GET /api/v1/intelligence/report/export` with JSON/CSV/PDF streaming support. No frontend button currently triggers this.
- **Files to Modify**:
  - `frontend/src/app/intelligence/page.tsx`
  - `frontend/src/components/intelligence/case-dossier-modal.tsx`
  - `frontend/src/lib/api.ts`
- **Actions**:
  1. Add `exportIntelligenceReport(format: 'json' | 'csv' | 'pdf')` helper in `frontend/src/lib/api.ts` with authenticated blob download handling (`window.URL.createObjectURL`).
  2. Add an "📥 Export Report" dropdown button in the header of `frontend/src/app/intelligence/page.tsx` offering CSV, JSON, and PDF download formats.
  3. Include loading spinners and success/error toasts using the existing toast system.
  4. Ensure downloads name files systematically: `CPAF-Intelligence-Report-<timestamp>.<ext>`.
- **Acceptance Criteria**:
  - Clicking "Export Report -> CSV" triggers a browser file download with HTTP 200 from `/api/v1/intelligence/report/export`.
  - Zero console errors; clean loading state.
- **Verification**:
  - `curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/v1/intelligence/report/export?format=csv`
  - Vitest test verifying button click triggers API call.

---

### Microtask 1.2 — Resolve Work-in-Progress `_wip` Components
- **Context**: `frontend/src/components/_wip/` contains `PredictionForm.tsx` and `RiskScoreCard.tsx`. Having a `_wip` directory in an evaluated codebase signals incomplete work to code auditors/judges.
- **Files to Audit/Modify**:
  - `frontend/src/components/_wip/PredictionForm.tsx`
  - `frontend/src/components/_wip/RiskScoreCard.tsx`
  - `frontend/src/components/dashboard/prediction-panel.tsx`
- **Actions**:
  1. Inspect `_wip/PredictionForm.tsx` and `_wip/RiskScoreCard.tsx` against `components/dashboard/prediction-panel.tsx`.
  2. Verify that `prediction-panel.tsx` already incorporates the full prediction workflow (form inputs, cashout prediction, top-k locations, risk badge).
  3. If redundant, safely remove the `frontend/src/components/_wip/` folder and clean up any references in `knip.json` or barrel exports.
  4. If unique features exist, integrate them directly into `prediction-panel.tsx`.
- **Acceptance Criteria**:
  - No `_wip` directories remain in the git-tracked frontend tree.
  - `npm run build` compiles with 0 errors.

---

### Microtask 1.3 — Public Overview Landing Page & Role Gateway
- **Context**: Currently, `frontend/src/app/page.tsx` simply does an unbranded client redirect to `/login`. Commercial benchmarks and demo visitors expect a hero overview summarizing platform capabilities.
- **Files to Modify**:
  - `frontend/src/app/page.tsx`
- **Actions**:
  1. Replace the bare redirect in `page.tsx` with a high-impact, professional command-center landing view:
     - Hero title: **"CASHGUARD-AI: Cybercrime Predictive Analytics Framework"**.
     - Subheading: Proactive intervention, cashout hotspot prediction, and money-mule detection for Law Enforcement Agencies.
     - 4 Feature Cards corresponding to the 4 USPs:
       1. *Trained XGBoost AML Detection* (Real IBM-dataset trained, ~0.98 ROC-AUC).
       2. *Geospatial Hotspot Map* (Leaflet clustering + haversine BallTree).
       3. *Real-Time Operational Alerts* (WebSocket live feeds with sound/toast).
       4. *Explainable AI (SHAP)* (Feature attribution for court-admissible evidence).
     - System Status pill: `"Status: Operational | Live Node: In-Memory / Redis"`.
     - Direct CTA button: **"Access Analyst Command Center →"** linking to `/login`.
- **Acceptance Criteria**:
  - Navigating to `http://localhost:3000/` loads the hero landing page instantly.
  - Clicking the CTA navigates smoothly to `/login`.
  - Fully responsive on mobile, tablet, and desktop viewports.

---

## ⚡ Phase 2: Core USP & Explainability (XAI + Triage)

### Microtask 2.1 — End-to-End SHAP Explainability Panel Wiring
- **Context**: Backend has `backend/app/ml/shap_explainer.py`. Frontend has `feature-importance-radar.tsx`, but it currently renders static/mock feature dimensions rather than dynamically reflecting the selected AML transaction's SHAP values.
- **Files to Modify**:
  - `frontend/src/components/analytics/feature-importance-radar.tsx`
  - `frontend/src/components/analytics/aml-transaction-panel.tsx`
  - `frontend/src/lib/api.ts`
- **Actions**:
  1. Ensure the transaction scoring endpoint or predict endpoint returns the top positive/negative SHAP feature attributions (`shap_values: { feature: string, impact: number, value: any }[]`).
  2. In `feature-importance-radar.tsx`, bind the props to the currently selected row in `aml-transaction-panel.tsx`.
  3. Render both:
     - Radar/Bar chart showing relative feature weights (e.g. `amount_log`, `trans_velocity_1h`, `is_new_counterparty`, `hop_distance`).
     - Plain-language attribution summary: *"Alert driven primarily by: 1) High velocity (3 transactions in 10m), 2) Rapid multi-hop transfer."*
- **Acceptance Criteria**:
  - Selecting different demo transactions (e.g. "Simulate High-Risk Mule Flow" vs "Low-Risk Retail") dynamically updates the radar and SHAP feature breakdown in real time.
- **Verification**:
  - Test with Playwright or Vitest component test with mocked SHAP payload.

---

### Microtask 2.2 — Centralized Alert Triage & Case Worklist Queue
- **Context**: Commercial AML benchmarks (ComplyAdvantage Mesh, Chainalysis) emphasize that analysts need a manageable worklist/queue, not just an ephemeral streaming ticker.
- **Files to Create/Modify**:
  - `frontend/src/app/alerts/page.tsx`
  - `frontend/src/components/alerts/CaseQueueTable.tsx` (NEW)
  - `frontend/src/lib/api.ts`
- **Actions**:
  1. Build a robust `CaseQueueTable.tsx` component mounted on the `/alerts` page:
     - Columns: `Case ID`, `Time Received`, `Category / Modus Operandi`, `Severity / Score`, `Target Jurisdiction`, `Assigned Officer`, `Status` (`New`, `Under Review`, `Escalated`, `Closed`), `Actions`.
     - Quick Filters: Filter by Severity (`High`, `Medium`, `Low`), Status, or Search by Account/Phone number.
     - Action buttons:
       - 👁️ "Review Dossier" (opens `CaseDossierModal`).
       - ⚡ "Quick Escalation" (marks as Escalated).
       - ✅ "Resolve" (marks as Resolved/False Positive).
  2. Wire the table state to auto-update when a new WebSocket incident is received.
- **Acceptance Criteria**:
  - Analysts can filter, sort, and change the status of cases directly from the table.
  - Works with existing `/api/v1/complaints` and `/api/v1/intelligence/alerts` endpoints.

---

### Microtask 2.3 — Active Learning Human-in-the-Loop Feedback Controls
- **Context**: The feasibility analysis highlighted that moving beyond synthetic/heuristic training requires real investigator feedback on false positives.
- **Files to Modify**:
  - `frontend/src/components/analytics/aml-transaction-panel.tsx`
  - `frontend/src/components/intelligence/case-dossier-modal.tsx`
  - `backend/app/api/v1/complaints.py` (verify status update endpoint)
- **Actions**:
  1. Add explicit feedback buttons to the transaction detail / dossier view:
     - 🔴 **"Confirm Malicious Fraud"** (increments true-positive weight).
     - 🟢 **"Mark Verified False Positive"** (flags for threshold tuning).
  2. Provide a quick dropdown modal: "Primary reason: [Legitimate Business Expense / Family Transfer / Known Merchant / Spoofed ID]".
  3. Show feedback confirmation toast: *"Feedback logged. Transaction added to model retrain queue."*
- **Acceptance Criteria**:
  - Triggering feedback persists status to backend without page reload.

---

## 🏛️ Phase 3: LEA Domain Adaptation & Legal Notice (SIH USP)

### Microtask 3.1 — Section 91 CrPC / Section 94 BNSS Bank Freeze Notice Generator
- **Context**: Identified as the single most impactful feature to resolve the "Golden Hour Actionability Dilemma" in the SIH review. Enables an officer to produce a formal statutory notice ordering an immediate temporary lien.
- **Files to Modify**:
  - `frontend/src/components/intelligence/case-dossier-modal.tsx`
- **Actions**:
  1. Add a **"⚖️ Generate Statutory Bank Notice (Sec 91 CrPC / 94 BNSS)"** button inside the Case Dossier modal.
  2. Implement an official template rendering:
     - **Header**: *"OFFICE OF THE SUPERINTENDENT OF POLICE / CYBER CRIME CELL"*.
     - **Legal Reference**: *"Notice under Section 91 Cr.P.C. / Section 94 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023"*.
     - **Addressee**: Bank Nodal Officer / Payment Gateway Switch.
     - **Body**: *"Urgent matter of cyber financial crime investigation. Account Number: [MASKED-ACC], Transaction ID: [TX-ID], Amount: ₹[AMOUNT]. You are hereby directed to place an IMMEDIATE DEBIT FREEZE / LIEN on the above account to prevent dissipation of stolen funds."*
     - Auto-filled officer credentials, system verification hash, timestamp, and digital signature block.
  3. Include a clean `@media print` CSS stylesheet so clicking "Print / Save PDF" produces a crisp, formal 1-page document with no UI chrome.
- **Acceptance Criteria**:
  - Generates a court-admissible, formatted statutory notice ready for print or PDF export.
  - Masks sensitive civilian PII while including essential banking transaction keys.

---

### Microtask 3.2 — National-to-District Jurisdiction Drill-Down
- **Context**: `FRONTEND_RESEARCH_AND_GAPS.md` noted that NCRP/CCTNS users operate across hierarchical jurisdictions (State → District → Police Station).
- **Files to Modify**:
  - `frontend/src/components/intelligence/state-breakdown.tsx`
- **Actions**:
  1. Update `state-breakdown.tsx` to support an interactive two-level hierarchy:
     - Top level: State incident counts (Maharashtra, Delhi, Karnataka, Haryana, etc.).
     - Clickable row: Clicking a state expands a nested District Hotspot list (e.g. for Maharashtra: *Mumbai Cyber Cell, Pune Rural, Thane, Cyberabad corridor*).
  2. Include incident volume bars and risk color indicators per district.
  3. Provide a "Filter Global Dashboard to this Jurisdiction" action button.
- **Acceptance Criteria**:
  - Clicking any state expands its district breakdown smoothly.
  - Provides a realistic demonstration of state cyber command center utility.

---

## 🛡️ Phase 4: Repository Hygiene, Polish & Test Automation

### Microtask 4.1 — Systematic Accessibility (ARIA) & Responsive Sweep
- **Context**: Modern judging rubrics assess UX accessibility and mobile responsiveness.
- **Files to Audit/Modify**:
  - `frontend/src/components/layout/AppShell.tsx`
  - `frontend/src/components/map/PredictiveMap.tsx`
  - `frontend/src/components/shared/NotificationBell.tsx`
- **Actions**:
  1. Audit interactive buttons and icons for explicit `aria-label` tags (audio mute toggle, notification bell, map layer toggles, modal close buttons).
  2. Verify that on smaller screen widths (< 768px), the `AppShell` mobile drawer slides in cleanly and map markers/panels remain scrollable.
  3. Ensure contrast ratios on dark mode badges meet WCAG AA standards.
- **Acceptance Criteria**:
  - 0 accessibility warnings from automated linting.
  - Clean rendering on mobile device emulation (375px width).

---

### Microtask 4.2 — Vitest Unit & Component Coverage for New Features
- **Context**: Maintain the high test standard (54+ passing tests).
- **Files to Create**:
  - `frontend/src/components/intelligence/__tests__/case-dossier-modal.test.tsx`
  - `frontend/src/components/alerts/__tests__/case-queue-table.test.tsx`
- **Actions**:
  1. Write unit tests for:
     - `CaseDossierModal`: renders case metrics, triggers notice generation, closes on ESC.
     - `CaseQueueTable`: filters by severity, changes status, handles empty state.
     - Report export API helper: verifies blob creation and error toast handling.
- **Acceptance Criteria**:
  - All new test files pass via `npm test` (`vitest run`).
  - Total frontend passing test count increases from 54 to 65+.

---

### Microtask 4.3 — Documentation Synchronization
- **Context**: Keep project documentation coherent and up-to-date.
- **Files to Modify**:
  - `docs/README.md`
  - `docs/FRONTEND_RESEARCH_AND_GAPS.md`
  - `docs/USP_ANALYSIS.md`
- **Actions**:
  1. Link `FRONTEND_USP_AND_FEASIBILITY_MICROTASKS.md` in `docs/README.md` under the "Start here / Status & plan" index.
  2. Update the gap table in `docs/FRONTEND_RESEARCH_AND_GAPS.md` to reflect microtasks in progress.
- **Acceptance Criteria**:
  - All cross-references use valid markdown links.

---

## 🚀 Execution Order Recommendation

```text
Step 1: Microtask 1.2 (Clean up _wip components — eliminates technical debt first)
Step 2: Microtask 1.1 (Export Intelligence Report button — instant quick win)
Step 3: Microtask 3.1 (Section 91 CrPC Bank Notice in Dossier — maximum SIH impact)
Step 4: Microtask 2.1 (SHAP Explainability Radar dynamic binding — ML USP proof)
Step 5: Microtask 2.2 (Alert Triage & Case Queue Table — workflow completeness)
Step 6: Microtask 1.3 (Public Overview Landing Page — visual first impression)
Step 7: Microtask 3.2 (District Drill-Down in State Breakdown — LEA hierarchy)
Step 8: Microtasks 4.1 to 4.3 (Test suite, accessibility polish, doc sync)
```
