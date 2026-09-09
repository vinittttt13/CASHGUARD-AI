-- CPAF Database Initialization Script
-- Run as PostgreSQL superuser: psql -U postgres -f init_db.sql

-- Create user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cpaf_user') THEN
        CREATE USER cpaf_user WITH PASSWORD 'cpaf_pass';
    END IF;
END
$$;

-- Create database if not exists
SELECT 'CREATE DATABASE cpaf_db OWNER cpaf_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cpaf_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cpaf_db TO cpaf_user;

-- Connect to cpaf_db and grant schema privileges
\c cpaf_db
GRANT ALL ON SCHEMA public TO cpaf_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cpaf_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cpaf_user;
