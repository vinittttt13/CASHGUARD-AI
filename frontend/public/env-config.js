// Placeholder for local `next dev` / a plain `docker build` with no
// entrypoint script run. In the production image, docker-entrypoint.sh
// overwrites this file with real runtime values before the server starts.
// See src/lib/runtime-env.ts for how this is consumed.
window.__ENV__ = {};
