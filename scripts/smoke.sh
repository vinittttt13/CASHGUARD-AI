#!/usr/bin/env bash
# End-to-end smoke test: point at a RUNNING stack (does not start anything).
#
#   docker compose up -d && docker compose exec -T backend python seed_db.py
#   scripts/smoke.sh
#
# Env: BASE_URL (default http://localhost:8000), FRONTEND_URL (default :3000),
#      SMOKE_EMAIL / SMOKE_PASSWORD.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
EMAIL="${SMOKE_EMAIL:-admin@cpaf.gov.in}"
PASSWORD="${SMOKE_PASSWORD:-admin123}"

pass=0 fail=0
check() { # name  expected_code  actual_code
  if [ "$2" = "$3" ]; then printf '  ok   %-42s %s\n' "$1" "$3"; pass=$((pass+1));
  else printf '  FAIL %-42s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== infra =="
check "backend /health"        200 "$(code "$BASE_URL/health")"
check "backend /health/ready"  200 "$(code "$BASE_URL/health/ready")"
check "frontend /"             200 "$(code "$FRONTEND_URL/")"
check "frontend /login"        200 "$(code "$FRONTEND_URL/login")"

echo "== auth =="
LOGIN_JSON="$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
TOKEN="$(printf '%s' "$LOGIN_JSON" | python -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null || true)"
if [ -n "$TOKEN" ]; then printf '  ok   %-42s\n' "login returns access_token"; pass=$((pass+1));
else printf '  FAIL %-42s %s\n' "login" "$LOGIN_JSON"; fail=$((fail+1)); fi
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "== data endpoints the UI uses =="
for path in \
  "/api/v1/auth/me" \
  "/api/v1/complaints?limit=5" \
  "/api/v1/complaints/stats/aggregate" \
  "/api/v1/intelligence/alerts" \
  "/api/v1/intelligence/trends?days=14" \
  "/api/v1/intelligence/report?days=7" \
  "/api/v1/locations/hotspots" \
  "/api/v1/locations/heatmap"
do
  check "GET $path" 200 "$(code "${AUTH[@]}" "$BASE_URL$path")"
done

echo "== stats keys are clean (no 'ComplaintCategory.' prefix) =="
STATS="$(curl -s "${AUTH[@]}" "$BASE_URL/api/v1/complaints/stats/aggregate")"
if printf '%s' "$STATS" | grep -q 'ComplaintCategory\.'; then
  printf '  FAIL %-42s %s\n' "stats enum keys" "$STATS"; fail=$((fail+1));
else printf '  ok   %-42s\n' "stats enum keys cleaned"; pass=$((pass+1)); fi

echo
echo "smoke: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
