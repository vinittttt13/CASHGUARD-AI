# Stage 1: Install dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# Cypress is a devDependency only used for local/CI e2e; its post-install binary
# download is unavailable in the build sandbox and not needed to compile Next.
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci

# Stage 2: Build the app
FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time — a
# container-runtime `environment:` entry (docker-compose.yml) has no effect
# on them. They must be supplied as build args instead.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
RUN npm run build

# Stage 3: Production runner
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Docker auto-sets HOSTNAME to the container id, and the Next.js standalone
# server binds to $HOSTNAME if set — resolving the container id to its own
# network IP only, not loopback or 0.0.0.0. That breaks any in-container
# healthcheck/tool hitting localhost/127.0.0.1 (external access still works,
# since Docker's port-forwarding targets the container's real IP). Force an
# explicit bind-all address instead of trusting whatever Docker injects.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --chown so the non-root nextjs user can rewrite env-config.js at startup
# (see docker-entrypoint.sh) — plain root-owned files aren't writable by it.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
