# Frontend Research & Gap Analysis (2026-09-11)

Research into what "similar sites" — commercial AML/fraud-monitoring
platforms and India's government cybercrime portals — put in front of
their users, compared against what CashGuard AI's frontend currently ships
(`frontend/src`, verified by direct inspection). Use this to prioritize
frontend work; it is descriptive + actionable, not a marketing document
(see `USP_ANALYSIS.md` for that).

## Sites/categories researched

- **Commercial AML/fraud SaaS**: ComplyAdvantage (Mesh platform), Chainalysis
  (KYT), SEON, ZigRam, and the broader 2026 AML-software vendor set
  surveyed by SymphonyAI/Ondato/Alessa/Gartner Peer Insights roundups.
- **India government cybercrime infrastructure**: National Cybercrime
  Reporting Portal (NCRP, cybercrime.gov.in), Citizen Financial Cyber
  Fraud Reporting and Management System (CFCFRMS), CCTNS, all under I4C
  (Ministry of Home Affairs).
- **General fraud-analytics UX patterns**: drawn from published dashboard
  architecture writeups (Microsoft Fabric fraud-detection reference
  architecture, Splunk Fraud Analytics app docs, LexisNexis fraud
  analytics).

## What CashGuard AI already has (confirmed today)

- Real-time analyst dashboard: stats overview, live predictive map
  (Leaflet: heatmap, ATM markers, geofence zones), prediction panel,
  complaint feed — `frontend/src/app/dashboard`.
- Dedicated AML/ML analytics workspace: transaction risk panel,
  time-series chart, confidence gauge, feature-importance radar,
  geographic distribution — `frontend/src/app/analytics`.
- Intelligence/investigation view: fraud-ring graph, hotspot grid, case
  dossier modal, state breakdown — `frontend/src/app/intelligence`.
- Real-time alert center fed by WebSocket (`alerts/AlertCenter.tsx`,
  `shared/NotificationBell.tsx`).
- RBAC-aware UI (`shared/RoleGuard.tsx`) and dark mode
  (`theme-provider.tsx`).

## Gap table

| Element | Who has it | Why it matters | Do we have it? | Recommendation |
|---|---|---|---|---|
| Centralized alert triage / case queue (list or kanban, assign/status) | ComplyAdvantage Mesh, Chainalysis case management | Analysts need a worklist, not just a feed | No — only a single `case-dossier-modal.tsx`, no list/queue view | **Add.** Build a case list page consuming the existing `/intelligence/alerts` and `complaints.py` CRUD endpoints — backend already supports it |
| Explainability panel exposing SHAP values to the analyst | ComplyAdvantage ("explainable AI governance"), SEON | Analysts and auditors need to see *why* a transaction was flagged, not just a score | Backend has `ml/shap_explainer.py`; frontend has a `feature-importance-radar.tsx` but it's not confirmed wired to live SHAP output per-transaction | **Add/verify.** Wire the existing radar component to the real SHAP endpoint output for the AML panel specifically |
| Exportable investigation/report (PDF/CSV) | Standard in every commercial AML tool; Chainalysis explicitly calls this out | Analysts need to hand off findings to prosecutors/regulators | Backend has `/intelligence/report` and `/intelligence/report/export`; **no frontend UI calls it** | **Add — highest-value, lowest-effort gap.** Add an "Export Report" button on the intelligence/case view; backend work is already done |
| Audit trail / activity log UI | Standard compliance requirement in AML SaaS | Regulators and internal review need to see who acted on what, when | Not found anywhere in `frontend/src/components` | **Add if pursuing compliance framing**, otherwise defer — low priority for a hackathon demo unless judges specifically probe compliance readiness |
| Admin/multi-tenant console (user management, org switch) | Standard in enterprise AML SaaS | Multiple agencies/departments need isolated views | Only inline `RoleGuard` gating; no admin console page | **Defer.** Out of scope for a single-department pilot; revisit only if multi-agency deployment becomes real |
| No-code rules engine for custom flagging thresholds | ComplyAdvantage, SEON | Lets compliance teams tune sensitivity without a redeploy | Not present — thresholds appear to be code/config-level | **Defer.** Reasonable for v1; document as a roadmap item rather than building now |
| National/state/district jurisdiction drill-down dashboard | NCRP, CFCFRMS | India-specific law-enforcement dashboards are built around jurisdiction hierarchy | `intelligence/state-breakdown.tsx` exists (state-level), no district drill-down | **Add if targeting LEA deployment** — extend the existing state breakdown component with a district dimension; data model would need a district field check |
| Citizen-facing complaint intake + chatbot (Vani/CyberDost-style) | NCRP | Lets the public self-report incidents | Not present — root page (`page.tsx`) is a pure auth redirect, no public form | **Not applicable.** CashGuard AI is an LEA/analyst-facing detection tool, not a citizen reporting portal — building this would be scope creep unless the product pivots to also being a public intake system |
| Bank/payment-intermediary integration for fund freeze | CFCFRMS (85 institutions wired in) | Enables actually stopping siphoned funds, not just detecting them | Not present — no bank API integration layer found | **Not applicable for this project's scope.** Requires real regulatory MOUs; document as a feasibility item (`FEASIBILITY_ANALYSIS.md`) rather than a frontend task |
| Public landing/marketing page | Every commercial vendor site | First impression for judges/stakeholders visiting the deployed URL | `frontend/src/app/page.tsx` redirects straight to `/login` | **Add for demo purposes.** A one-page landing summarizing the product before login would help pitch context; low effort |
| Systematic accessibility (ARIA coverage) and mobile nav | Expected baseline for any modern SaaS | Usability/judging criteria often include this | Partial — some ARIA attributes on `AppShell.tsx`, responsive Tailwind classes (`sm:`/`md:`/`lg:`) in ~16 files, but not systematic | **Polish pass**, not urgent — sweep for missing `aria-label`s and test key flows at phone width |
| Finish work-in-progress components | — | Backend ML capability (prediction, risk scoring) is ahead of shipped UI | `_wip/PredictionForm.tsx`, `_wip/RiskScoreCard.tsx` explicitly marked WIP | **Finish or remove.** Either complete these against the live `/predict` endpoints or delete them — half-finished components under `_wip/` are a visible signal of incompleteness if a judge browses the repo |
| System-health / ingestion monitoring view | Splunk Fraud Analytics, Microsoft Fabric fraud reference architecture | Ops visibility into whether the pipeline itself is healthy | Not present | **Defer.** Reasonable for a production SOC tool, not essential for a detection-accuracy-focused demo |

## Bottom line

The two highest-value, lowest-effort additions are wiring the existing
**report export** button and the **SHAP explainability panel** to backend
endpoints that already exist — this is UI work only, no new ML or backend
logic required. The **case queue/worklist** is the next priority and also
mostly consumes existing endpoints. Citizen-intake and bank-integration
features from the government-portal comparison are explicitly **not
applicable** to this product's LEA-analyst-facing scope and should not be
built just because a reference site has them.

## Sources

ComplyAdvantage (Mesh), Chainalysis (KYT), SEON, ZigRam AML feature
guides, SymphonyAI/Ondato/Alessa/Gartner Peer Insights 2026 AML-software
roundups, National Cybercrime Reporting Portal (cybercrime.gov.in) and
I4C/MHA public documentation on NCRP/CFCFRMS/CCTNS, Microsoft Fabric fraud
detection reference architecture, Splunk App for Fraud Analytics
documentation.

See also: [`USP_ANALYSIS.md`](./USP_ANALYSIS.md),
[`FEASIBILITY_ANALYSIS.md`](./FEASIBILITY_ANALYSIS.md),
[`PROJECT_STATUS_AND_GAPS.md`](./PROJECT_STATUS_AND_GAPS.md).
