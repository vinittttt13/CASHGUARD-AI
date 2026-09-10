# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

# Build toolchain + Postgres client headers. GEOS/PROJ are vendored inside the
# shapely / pyproj manylinux wheels, so no system GDAL/GEOS packages are needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Stage 2: Final runtime image
FROM python:3.11-slim

# Runtime shared libs: libpq for asyncpg/psycopg, curl for the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --group appuser

WORKDIR /app

# Copy wheels and install
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Matplotlib/Prophet need a writable config dir when running as non-root.
ENV MPLCONFIGDIR=/tmp/matplotlib

# Copy application code
COPY . .

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
