# Feasibility Analysis (2026-09-11)

An honest assessment of how feasible CashGuard AI is to build further,
deploy, and adopt — grounded in the verified state documented in
[`PROJECT_STATUS_AND_GAPS.md`](./PROJECT_STATUS_AND_GAPS.md) and the
competitive context in [`FRONTEND_RESEARCH_AND_GAPS.md`](./FRONTEND_RESEARCH_AND_GAPS.md)
and [`USP_ANALYSIS.md`](./USP_ANALYSIS.md). This is written for a judge or
stakeholder deciding whether the project is more than a demo.

## Summary scorecard

| Dimension | Feasibility | Why |
|---|---|---|
| Technical (local/demo) | **High** | Full stack runs, 175+54+63 tests pass, real trained model on disk |
| Technical (cluster/production infra) | **Medium** | Two confirmed K8s manifest bugs, never applied to a live cluster |
| Data | **Low–Medium** | Trained on IBM's synthetic AML dataset, not real bank/UPI data |
| Integration (govt/bank systems) | **Low** | No API access, MOUs, or approvals exist or are underway |
| Regulatory | **Low** | No compliance/legal review has occurred; data-sharing law unaddressed |
| Operational (as-is deployment) | **Medium** | Strong recall, but low precision means high analyst false-positive load |

## Technical feasibility

**Proven today:** the application runs end-to-end via Docker Compose;
backend (175 tests), frontend (54 tests), and MCP server (63 tests) all
pass; a real XGBoost AML model is trained and checked in with measured
metrics, not a placeholder. CI runs lint/type-check/test/build/security-scan
on every change. This is a working system, not a slide deck.

**Unproven:** no Kubernetes manifest in this repo has ever been applied to
a live cluster. Two concrete bugs confirm this — a broken Postgres exec
probe (`$(VAR)` doesn't expand in K8s exec-probe arrays) and an Ingress
rewrite rule that would break `/api/*` routing — both would be caught
immediately by a real deployment attempt but have survived multiple
documentation passes because nothing has actually been deployed to a
cluster. **Conclusion: local/demo feasibility is proven; production
infrastructure feasibility is not, and should not be claimed as done.**

## Data feasibility

The AML model is trained on IBM's public synthetic AML transaction
dataset. This is a legitimate and realistic dataset for demonstrating the
ML approach, but it is not real bank or UPI transaction data. A real
deployment would require:

- A data-sharing agreement with a bank, NPCI, or payment processor.
- Re-training/re-validating the model on real transaction distributions,
  which likely differ substantially from the synthetic dataset (real
  fraud rates, feature distributions, and label quality will differ).
- Handling PII/financial-data compliance requirements that don't exist
  when working with a public synthetic dataset.

**Conclusion: the ML *approach* is validated; the specific trained model
is not validated against real-world data, and that gap is the single
largest technical risk to any claim of production readiness.**

## Integration feasibility (the largest overall risk)

As identified in `USP_ANALYSIS.md`, CashGuard AI does not integrate with
NCRP, CFCFRMS, CCTNS, or NPCI/bank rails. Getting there would require:

- Government approval and onboarding through I4C (the body operating
  NCRP/CFCFRMS) — a non-technical, multi-agency process with no fixed
  timeline.
- API/data-sharing agreements with individual banks or NPCI, similar to
  the 85-institution integration CFCFRMS already has — a project of this
  scale typically takes agencies years, not a hackathon cycle.
- Alignment with existing case-management workflows at CCTNS so LEA
  analysts aren't asked to run a second, disconnected tool.

**Conclusion: this is not a technical blocker — it's an institutional and
regulatory one, and it's the main reason CashGuard AI should be framed as
a decision-support tool for a pilot deployment, not a replacement for or
direct integration into existing national infrastructure in its current
form.**

## Regulatory feasibility

No legal or compliance review has been conducted on data handling, model
bias/fairness, or explainability requirements that a real financial-crime
detection tool would need before deployment (e.g. RBI data-localization
rules, DPDP Act 2023 obligations for financial/personal data). This is
undone work, not a solved problem — flagged here rather than assumed away.

## Operational feasibility

The trained AML model has strong recall (~90%) and ROC-AUC (~0.98) but
precision in the 34–46% range depending on training run (see
`AML_FEATURE_REPORT.md` and `PROJECT_STATUS_AND_GAPS.md`). In practice,
this means a majority of flagged transactions in a live deployment would
be false positives. For a demo or pilot with a small analyst team
reviewing a manageable volume, this is acceptable. At real transaction
volumes (a bank or NPCI scale), this precision level would overwhelm any
analyst team without further model tuning, threshold calibration, or a
human-in-the-loop triage stage (the case-queue feature identified as
missing in `FRONTEND_RESEARCH_AND_GAPS.md` would help manage this, not
solve the underlying precision problem).

## What would make this genuinely production-feasible

In rough priority order:

1. Fix the two known K8s manifest bugs and actually deploy to a real
   (even single-node) cluster to surface what else breaks.
2. Wire the missing report-export and explainability UI (low effort,
   backend already supports both — see `FRONTEND_RESEARCH_AND_GAPS.md`).
3. Build the case-queue/triage workflow so a low-precision model is
   operationally manageable by a small analyst team.
4. Pursue a real (even limited/anonymized) transaction dataset for
   re-validation before any precision or accuracy claims are made about
   real-world performance.
5. Treat government/bank integration as a separate, multi-year
   institutional workstream — not a near-term engineering task.

## Bottom line

CashGuard AI is **technically feasible as a working proof-of-concept
today** — that part is proven, not claimed. It is **not yet feasible as a
production system integrated with real financial or government
infrastructure**, and the barriers there are primarily institutional,
regulatory, and data-access problems rather than software engineering
ones. Framing it honestly as a strong analytical prototype ready for a
pilot — rather than a finished production system — is both more accurate
and, for a judging context, a more credible claim.
