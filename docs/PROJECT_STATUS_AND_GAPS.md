# CASHGUARD-AI — Project Status & Gaps (2026-09-11)

This is a verified snapshot: claims below were checked against the running
code and test suites today, not copied from older docs. It supersedes the
status sections of `REPO_ANALYSIS_AND_IMPROVEMENTS.md`, `REPO_STATUS_AND_REMAINING_WORK.md`,
`REMAINING_ISSUES.md` and `TODO_TODAY.md` where they conflict — those docs
are kept for history but drifted apart over time and disagree with each
other and with the current code in places. Treat *this* file as current.

## What is actually done and working

Verified by running the suites, not by reading claims:

- **Backend**: 175 tests passed, 3 skipped (Prophet/CmdStan — see below), 4
  deselected. FastAPI app with real auth (JWT + RBAC), rate limiting,
  WebSocket live feed, structured logging, async SQLAlchemy 2.0 + Alembic
  migrations.
- **Frontend**: 54 vitest tests passed across 10 files. Next.js 14 App
  Router, real API wiring (no mock data standing in for backend calls),
  auth flow, WebSocket-driven dashboard, AML transaction panel mounted on
  Analytics.
- **MCP server**: 63 tests passed in its isolated venv — a real
  implementation (DB/ML/Redis tools), not a stub.
- **AML ML pipeline is real and trained**: `backend/app/ml/model_artifacts/`
  contains `xgboost_aml.pkl` plus its metrics file, alongside the
  location/risk/hotspot models (`xgboost_location.pkl`, `rf_risk.pkl`,
  `kmeans_hotspot.pkl`). Trained on the actual IBM AML dataset, not synthetic
  placeholders. Reported metrics: ROC-AUC ~0.98, recall ~90%, precision in
  the 34–46% range depending on run (see "Known limitations" below — this is
  disclosed, not hidden).
- **CI**: lint, type-check, test, build, and a security scan job all run in
  `.github/workflows/ci.yml` against real paths/commands.
- No `TODO`/`FIXME`/`NotImplementedError`/stub auth found anywhere in
  `backend/app` or `frontend/src` — the codebase itself has no half-finished
  code paths left in it. The remaining gaps are all in infra config, one UI
  affordance, and dataset/dependency hygiene (below).

## Confirmed still broken (with evidence)

1. **Kubernetes Postgres readiness/liveness probes are broken.**
   `kubernetes/postgres-statefulset.yaml:67,72` still uses
   `command: ["pg_isready", "-U", "$(POSTGRES_USER)", "-d", "$(POSTGRES_DB)"]`.
   Kubernetes exec probes do **not** expand `$(VAR)` inside an array-form
   command — this will fail on any real cluster and has never been tested
   against one.

2. **Kubernetes Ingress path rewrite is wrong.**
   `kubernetes/ingress.yaml` combines
   `nginx.ingress.kubernetes.io/rewrite-target: /` with a plain
   `path: /api` (`Prefix`), with no regex capture group and no
   `use-regex` annotation. This rewrites all `/api/*` traffic to literal
   `/`, breaking API routing through the Ingress.

   Both of the above are why: **no K8s manifest here has ever been applied
   to a live cluster.** Every prior "Kubernetes: fixed" note in the older
   docs was a YAML-syntax read-through, not a cluster test — that's how
   these two bugs survived multiple audit passes.

3. **Dead button in Settings.** `frontend/src/app/settings/page.tsx:352` —
   the "Generate New Key" button has no `onClick` handler, unlike the
   adjacent buttons on the same page that do.

4. **No dataset versioning.** No `*.dvc` files or `dvc.yaml` anywhere under
   `dataset/`. The 40GB IBM AML dataset is just `.gitignore`d and unpinned —
   anyone re-cloning has no reproducible way to fetch the exact data used to
   train the checked-in model artifacts.

5. **CodeQL has never actually run.** The workflow file
   (`.github/workflows/codeql.yml`) exists and looks correct, but git
   history shows no run-triggering activity beyond the commit that added
   it — its findings (if any) are unverified.

## Known, disclosed limitations (not bugs, but worth stating plainly)

- **Prophet/CmdStan temporal model is absent.** No `prophet_temporal.pkl`
  in `model_artifacts/` because CmdStan isn't installed in this
  environment. The 3 skipped backend tests are this exact gap. The code has
  a documented fallback path; it just means temporal forecasting isn't
  exercised end-to-end here.
- **AML model precision is low** (~34–46% depending on training run) even
  though recall and ROC-AUC are strong. That means a real deployment would
  see a meaningful false-positive rate on flagged transactions — fine for a
  hackathon demo, a genuine limitation for production framing.
- **27 known dependency CVEs remain**, and they're genuinely blocked by
  upstream pins (e.g. starlette/pytest major-version constraints, `ecdsa`
  and `nltk` with no upstream fix available at all yet) — not an oversight,
  just currently unresolvable without breaking other pins.
- **Domain/system-integration gaps** are the largest unaddressed area:
  there is no integration with India's actual law-enforcement/financial
  crime infrastructure (NCRP, CCTNS, CFCFRMS, NPCI). This is a product/scope
  gap, not a code defect — flagged clearly in
  `SIH_JUDGE_EVALUATION_AND_IMPROVEMENT_AREAS.txt` as the single largest
  weakness for judging purposes (scored 14/20 on that dimension in that
  doc's own self-assessment).

## Documentation hygiene note

The docs folder has accumulated multiple overlapping status/audit files
written on different days that now disagree with each other (e.g.
`REPO_STATUS_AND_REMAINING_WORK.md` claims the Kubernetes issues are fixed;
`REMAINING_ISSUES.md`, written the same day as this file, found they are
not — and that's the version confirmed correct here). Recommend
consolidating `REPO_STATUS_AND_REMAINING_WORK.md`, `REMAINING_ISSUES.md`,
`TODO_TODAY.md`, and this file into one living status doc once the K8s and
settings-button fixes above land, rather than continuing to add new
dated snapshots.

## Bottom line

The application itself (backend, frontend, MCP, ML, tests, CI) is genuinely
complete and demo-ready locally via Docker Compose. What's left is narrow
and concrete: two Kubernetes YAML bugs that have never been cluster-tested,
one dead UI button, missing dataset versioning, a set of unresolvable
upstream CVEs, and — the biggest one for judging — no integration with
real Indian law-enforcement/financial-crime systems.
