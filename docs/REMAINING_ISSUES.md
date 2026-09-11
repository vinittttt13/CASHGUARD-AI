# CASHGUARD-AI — Remaining Issues (Latest Pass)

> **Date:** 2026-09-11
> **HEAD at time of writing:** `0107b42` (pushed to `origin/main`)
> **Method:** Independent re-verification pass — every claim in the two prior audit docs ([`PROJECT_COMPLETION_REPORT.md`](../PROJECT_COMPLETION_REPORT.md), [`REPO_STATUS_AND_REMAINING_WORK.md`](REPO_STATUS_AND_REMAINING_WORK.md)) was spot-checked against current source rather than trusted, and a fresh sweep was run for anything new. **This file supersedes both of those for "what's left" — read this one first.**
> **Status:** Analysis only. Nothing below has been fixed yet.

---

## 1. Two real, newly-discovered bugs — both in files nobody has cluster-tested

This is the headline finding: the prior pass fixed the Kubernetes deployability gap and validated every manifest as *syntactically* correct YAML, but syntactic validity isn't semantic correctness — and two genuine bugs slipped through that only a live-cluster test (which still hasn't happened) would catch.

### 1.1 `kubernetes/postgres-statefulset.yaml` — liveness/readiness probes are broken
- **Evidence:** lines ~67 and ~72:
  ```yaml
  livenessProbe:
    exec:
      command: ["pg_isready", "-U", "$(POSTGRES_USER)", "-d", "$(POSTGRES_DB)"]
  readinessProbe:
    exec:
      command: ["pg_isready", "-U", "$(POSTGRES_USER)", "-d", "$(POSTGRES_DB)"]
  ```
- **Problem:** Kubernetes' `$(VAR_NAME)` env-var substitution only applies to a container's own `command`/`args` — **not** to probe `exec.command` arrays. This is a documented, long-standing Kubernetes limitation (upstream: kubernetes/kubernetes#40846). An exec probe runs as a raw `exec()` with no shell, so `pg_isready` receives the literal strings `$(POSTGRES_USER)` and `$(POSTGRES_DB)` as arguments — not the real username/db — and fails immediately on a real cluster.
- **Notable inconsistency:** `kubernetes/redis-deployment.yaml`'s probes, added in the *same* commit, got this right by wrapping in a shell: `["sh", "-c", "redis-cli -a \"$REDIS_PASSWORD\" ping | grep -q PONG"]`. Postgres didn't get the same treatment.
- **Fix direction (not applied):** wrap the same way — `["sh", "-c", "pg_isready -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\""]` (env vars are already present on the container via `secretKeyRef`, so plain shell expansion picks them up).

### 1.2 `kubernetes/ingress.yaml` — rewrite-target likely breaks all API routing
- **Evidence:** `nginx.ingress.kubernetes.io/rewrite-target: /` annotation combined with a plain `pathType: Prefix` rule for `/api` (no regex-capture path like `/api(/|$)(.*)`, no matching `rewrite-target: /$2`, no `nginx.ingress.kubernetes.io/use-regex: "true"` annotation).
- **Problem:** this is a well-documented nginx-ingress-controller gotcha. With a plain prefix match, `rewrite-target: /` rewrites **every** matched request to the literal path `/` — not "the matched path with the prefix stripped." As written, a request to `/api/v1/predict` or `/api/v1/ws/live-feed` would be rewritten to `/` before it ever reaches `backend-service`, breaking essentially all API traffic through the Ingress.
- **Fix direction (not applied):** either use a capture-group rewrite (`path: /api(/|$)(.*)`, `rewrite-target: /$2`, `use-regex: "true"`) or drop the rewrite entirely if the backend already expects the `/api` prefix (it does — routes are registered under `/api/v1/...`), in which case no rewrite annotation is needed at all.

**Why these matter more than their individual severity suggests:** both were introduced or left in place across three separate audit/fix passes today, all of which validated the k8s manifests only by YAML-parsing them (`yaml.safe_load_all`), never by applying them to a cluster. That's a real blind spot in how "done" was assessed, not just two isolated bugs — see §4.

---

## 2. Confirmed genuinely fixed (independently re-verified, not just re-read)

- **Runtime-config injection** (`frontend/docker-entrypoint.sh`, `frontend/src/lib/runtime-env.ts`, `frontend/src/app/layout.tsx`) — implementation matches what was claimed; an edge case (empty-string env var) was checked and handled correctly (`getRuntimeEnv` treats `""` as falsy and falls through rather than "overriding" with a blank value).
- **`kubernetes/backend-config.yaml`** — all 13 keys cross-checked field-by-field against `backend/app/core/config.py`'s `Settings` class; all match exactly (pydantic-settings' case-insensitive env matching). Only `DB_POOL_PRE_PING` is omitted, which is harmless — it defaults to `True` in code.
- **Dependency CVE count is stable** — a fresh `pip-audit` run this pass found exactly the same 27 vulnerabilities across the same 5 packages (`pytest`, `pyasn1`, `starlette`, `ecdsa`, `nltk`) as previously documented. Nothing drifted, nothing regressed, no new CVE appeared.
- **Git state is clean and fully synced** — `origin/main` exactly matches local `HEAD` (`0107b42`); no stray uncommitted work.
- **TODO/FIXME/mock/dummy/console.log sweep is still clean** — re-run, zero hits across `backend/app`, `frontend/src`, `mcp/server.py`.
- **`retrain.yml`** correctly uses `python -m app.ml.train --production --publish ...` and never commits model binaries to git — only a validation-gated CI artifact upload.
- **`network-policy.yaml`/`ingress.yaml`** service/label names (aside from the rewrite bug above) are internally consistent with the Deployment/Service names used elsewhere.
- **CI's `docker-build` job passing no `build-args` for the frontend image (previously flagged as "K2, Critical") is now correctly understood as a non-issue**, not an oversight: the runtime-config injection means whatever gets baked in at CI build time is only a fallback default — the real, deployed value is genuinely supplied and overridable at container start via the ConfigMap, regardless of the CI build. This should be read as **closed by the architecture change**, not as an open item — the two prior docs left this ambiguous rather than stating it plainly.

---

## 3. Still open (carried over, re-confirmed still true — not re-explained in depth here, see prior docs)

- No live Kubernetes cluster has been available in any of today's sessions to actually apply these manifests — this is precisely what let §1's two bugs through.
- `starlette`/`pytest` CVEs remain genuinely blocked by upstream pins (`fastapi==0.111.0` → `starlette<0.38.0`; `python-jose` → `pyasn1<0.5.0`); `ecdsa`/`nltk` have no fix published upstream at all.
- `.github/workflows/codeql.yml` exists but has never actually run (needs GitHub Actions infrastructure).
- Prophet/CmdStan model-artifact gap and DVC dataset-versioning gap — unchanged.
- Frontend test coverage gaps — no Playwright e2e for the Settings page, no Vitest unit tests for Analytics/Intelligence components.
- `backend/tests/conftest.py`'s unit-test layer still runs against in-memory SQLite, not real Postgres (only the separate e2e/smoke CI path exercises real Postgres).

---

## 4. New this pass: documentation-accuracy issues in `PROJECT_SUMMARY.md`

A collaborator (different git author) independently added `PROJECT_SUMMARY.md` in commit `5322420`, merged cleanly with no code conflicts. It's largely accurate and mostly restates `README.md`, but has two concrete inaccuracies:

- Claims the `kubernetes/` directory includes an **HPA** (HorizontalPodAutoscaler) — no such manifest exists anywhere in `kubernetes/` (verified by directory listing).
- Lists **"TanStack Query"** in the frontend tech stack — `frontend/package.json` has no `@tanstack/*`, `react-query`, or `swr` dependency; data fetching goes through a custom `useApiResource` hook. This is simply incorrect, not aspirational.

Everything else in the file (architecture diagram, quick-start commands, API endpoint list, repo structure) was spot-checked and matches the real repo.

---

## 5. Suggested next step

Fix §1.1 and §1.2 (both are small, well-understood, low-risk YAML edits), then — before writing another audit doc — get actual `kubectl` access to a cluster (even `kind`/`minikube` locally) and do one real `kubectl apply -f kubernetes/<file>.yaml` pass per manifest. Every other area of this repo has now been verified by an actual execution (tests run, builds run, containers started, browser-driven UI checks) — Kubernetes is the one area still verified only by reading, and reading missed two bugs that execution would have caught in seconds.
