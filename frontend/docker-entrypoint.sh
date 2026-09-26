#!/bin/sh
# Regenerate public/env-config.js from the container's actual runtime env
# vars before starting the server. This is what makes NEXT_PUBLIC_API_URL /
# NEXT_PUBLIC_WS_URL genuinely configurable per environment (e.g. a
# Kubernetes ConfigMap) without rebuilding the image — see
# src/lib/runtime-env.ts for the client-side half of this.
set -e

cat > /app/public/env-config.js <<EOF
window.__ENV__ = {
  NEXT_PUBLIC_API_URL: "${NEXT_PUBLIC_API_URL:-}",
  NEXT_PUBLIC_WS_URL: "${NEXT_PUBLIC_WS_URL:-}"
};
EOF

exec node server.js
