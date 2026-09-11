# CASHGUARD-AI — What's Left to Finish Today

> **Date:** 2026-09-11
> **HEAD at time of writing:** `b43da9a` (pushed to `origin/main`)
> **Method:** Fresh audit re-verifying every open item from prior passes against current source, plus a full review of a collaborator's new AML XGBoost feature (commit `e32e480`) that hadn't been looked at yet. Nothing below has been fixed — this is the prioritized punch list.
> **Status of everything NOT on this list:** local run, Docker Compose, live UI, WebSocket, the map, auth, CI lint/test/build/security scanning, and test coverage for every previously-untested module are all fixed and verified working (see `PROJECT_COMPLETION_REPORT.md` and today's test-suite commit). This file is deliberately narrow — only what's still open.

---

## Tier 1 — Small, concrete, blocking a real Kubernetes deploy (do these first)

Both carried over unfixed from `docs/REMAINING_ISSUES.md`. Each is a single-file, well-understood edit.

### 1. `kubernetes/postgres-statefulset.yaml` — probes are broken
Lines ~67 and ~72 use:
```yaml
command: ["pg_isready", "-U", "$(POSTGRES_USER)", "-d", "$(POSTGRES_DB)"]
```
Kubernetes does **not** expand `$(VAR)` inside a probe's `exec.command` array (only inside a container's own `command`/`args`). The probe gets the literal string `$(POSTGRES_USER)`, not the real value, and fails on any real cluster.

**Fix:** shell-wrap it, the same way `redis-deployment.yaml`'s probes already do:
```yaml
command: ["sh", "-c", "pg_isready -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\""]
```

### 2. `kubernetes/ingress.yaml` — rewrite-target breaks all `/api` routing
`nginx.ingress.kubernetes.io/rewrite-target: /` is combined with a plain `pathType: Prefix` rule for `/api` — no capture-group path (`/api(/|$)(.*)`), no matching `rewrite-target: /$2`, no `use-regex: "true"`. This is a well-known nginx-ingress gotcha: a plain prefix match with that rewrite rewrites **every** matched request to the literal path `/`, so `/api/v1/predict` etc. would never reach `backend-service`.

**Fix:** either use the capture-group rewrite pattern, or — since the backend already expects requests under `/api/v1/...` — just drop the `rewrite-target` annotation entirely (no rewrite needed).

---

## Tier 2 — The new AML XGBoost feature needs finishing touches

A collaborator (commit `e32e480`) added a real, well-built AML transaction classifier: `backend/app/ml/aml_xgboost_model.py`, `train_aml.py`, a new `/api/v1/predict/aml-transaction` endpoint, and its own solid test suite (`test_aml_xgboost.py`, 87% coverage). Auth/validation on the new endpoint matches the rest of the API — no issue there. But as shipped:

### 3. No trained model is committed — the endpoint is currently inert
`backend/app/ml/model_artifacts/` only has `xgboost_aml_metrics.json` (the metrics report), no `.pkl`. `prediction_service.py:362` does `self.registry.get("xgboost_aml")` → `None` → falls back to a much cruder 3-rule heuristic (lines 374-398). This is graceful (no crash), and matches the existing pattern of gitignoring trained models — but right now, **nobody else who pulls this branch gets the actual ML model**, only the fallback. If this needs to work today (e.g., for a demo), run `cd backend && python -m app.ml.train_aml` to produce the artifact locally.

### 4. Zero frontend wiring
`frontend/src/lib/api.ts` and `frontend/src/types/api.ts` have no reference to the new endpoint anywhere. The feature is backend-only and unreachable from the actual product UI. Decide today whether this is in scope to wire up, or explicitly deferred.

### 5. Model quality — precision is genuinely low, worth knowing before relying on it
The committed metrics (`[[35810,2241],[113,1145]]` confusion matrix) are real, not fabricated — they check out to 91.0% recall (matches the commit message) but only **33.8% precision**. Roughly 2 out of every 3 transactions the model flags as laundering are false positives. Not a bug to fix, but something to flag if this gets demoed as a finished capability.

### 6. `train_aml.py` has 0% test coverage
128 statements, untested (the model class itself is well-tested; the training script isn't). Lower priority than 3-5 above.

---

## Tier 3 — Small doc-accuracy cleanup

### 7. `PROJECT_SUMMARY.md` still has two inaccuracies
- Line ~88 lists "TanStack Query" as a frontend dependency — not actually used (`useApiResource` is a custom hook; no `@tanstack/*`/`react-query`/`swr` in `package.json`).
- Line ~127 claims the `kubernetes/` directory includes an **HPA** (HorizontalPodAutoscaler) — no such manifest exists.

Quick fix, low urgency, but easy to knock out alongside Tier 1.

---

## Confirmed NOT a problem (checked this pass, no action needed)

- Full backend suite: **155 passed, 3 skipped (documented Prophet/CmdStan gap), 0 failed.** Coverage sits at 75.5% (the dip from 79% is only because the new, currently-untested `train_aml.py` was added — not a regression anywhere previously covered).
- No new TODO/FIXME/mock/dummy/placeholder patterns introduced by any commit today.
- No new undeclared dependency — the AML code's imports (`joblib`, `numpy`, `pandas`, `xgboost`, `sklearn.preprocessing`) are all already in `requirements.txt`.
- `git log --all -- .env .env.local` is still empty — no secrets have entered git history from any contributor today.

---

## Suggested order for today

1. Fix Tier 1, items 1–2 (two small YAML edits, ~10 minutes combined).
2. Decide on Tier 2: if the AML feature needs to be demo-ready today, run `train_aml.py` locally to produce the artifact (item 3) and decide whether frontend wiring (item 4) is in scope for today or explicitly deferred to a follow-up.
3. Tier 3 (item 7) whenever convenient — lowest stakes on this list.
