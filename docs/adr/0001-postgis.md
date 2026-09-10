# ADR 0001 — Drop PostGIS; keep in-process BallTree for geospatial queries

- **Status:** Accepted (2026-09-10)
- **Context microtask:** MT-07 (schema management)

## Context

The stack advertised PostGIS: the Postgres image was `postgis/postgis:15-3.3`,
migration `0001` ran `CREATE EXTENSION postgis` and built three GIST indexes over
`ST_SetSRID(ST_MakePoint(lng, lat), 4326)` expressions, and the README listed
"GDAL/PostGIS system libraries" as a requirement.

However **no application code uses PostGIS**. All proximity / radius / nearest-
neighbour queries run in Python:

- `app/ml/feature_engineering.py` — `sklearn.neighbors.BallTree` (haversine)
- `app/services/geospatial_service.py` — `BallTree` (haversine), rebuilt on a TTL

There are no `ST_*` calls, no `geoalchemy2`, no `Geometry`/`geography` columns.
The GIST indexes were therefore dead weight, and the PostGIS image + GDAL libs
inflated build time and image size (and broke the backend image build when the
base image rolled to Debian trixie — see MT-01).

## Decision

**Drop PostGIS now.**

- Postgres image: `postgis/postgis:15-3.3` → `postgres:15` (docker-compose and
  the Kubernetes StatefulSet).
- Migration `0001`: remove `CREATE EXTENSION postgis` and the three
  `ST_MakePoint` GIST indexes. Replace them with plain btree composite indexes
  on `(latitude, longitude)` / `(predicted_latitude, predicted_longitude)` —
  enough to support bounding-box pre-filtering if a query ever needs it.
- README: stop claiming PostGIS / GDAL.
- Keep the BallTree code paths unchanged.

## Consequences

- Smaller images, faster builds, one less extension to provision, no superuser
  requirement at migration time.
- Geospatial work stays in-process. This is fine at the current data scale
  (thousands of ATMs, tens of thousands of complaints) — the BallTree rebuilds
  in milliseconds and is cached.

## When to revisit (Option A — adopt PostGIS)

Reconsider as a dedicated epic if any of these become true:

- withdrawal-location or complaint counts reach the millions, or the BallTree
  rebuild / memory footprint becomes a bottleneck;
- we need spatial joins in SQL (e.g. "complaints within polygon X") or
  server-side `ST_DWithin` filtering to avoid pulling rows into Python;
- we want spatial data shared by non-Python consumers (BI tools, GIS).

Adoption path: add `geoalchemy2`, give `withdrawal_locations` and `complaints` a
`geography(Point, 4326)` column kept in sync with lat/lng, add a real GIST
index, and move the hot radius filters to `ST_DWithin`.
