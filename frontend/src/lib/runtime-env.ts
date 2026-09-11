/**
 * NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
 * which is fine for a single docker-compose deployment (one image, one
 * target) but breaks the "build once, deploy anywhere" model Kubernetes
 * expects — a ConfigMap change would need a full image rebuild to take
 * effect. To make the same built image portable across environments, the
 * container entrypoint (see frontend/docker-entrypoint.sh) writes the
 * *actual* runtime env vars into public/env-config.js as `window.__ENV__`,
 * loaded via a beforeInteractive <Script> in app/layout.tsx — guaranteed to
 * run before any app code, including this module's own evaluation.
 *
 * Precedence: window.__ENV__ (real runtime value) > NEXT_PUBLIC_* (value
 * baked in at image build time, e.g. local docker-compose) > hardcoded
 * localhost default (bare `next dev`).
 */
declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

export function getRuntimeEnv(key: string, fallback: string): string {
  if (typeof window !== 'undefined' && window.__ENV__?.[key]) {
    return window.__ENV__[key] as string;
  }
  return process.env[key] || fallback;
}
