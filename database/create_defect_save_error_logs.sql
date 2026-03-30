-- Central defect save error logs table for Supabase/PostgreSQL
-- Apply this script in Supabase SQL Editor before using the admin error-log panel.

CREATE TABLE IF NOT EXISTS defect_save_error_logs (
    id               BIGSERIAL PRIMARY KEY,
    client_log_id    VARCHAR(80) UNIQUE,
    operation        VARCHAR(30) NOT NULL,
    defect_id        BIGINT,
    pending_source   VARCHAR(30) DEFAULT 'manual',
    stage            VARCHAR(50),
    error_type       VARCHAR(50),
    message          TEXT NOT NULL,
    error_code       VARCHAR(50),
    error_details    TEXT,
    error_hint       TEXT,
    runtime_context  JSONB DEFAULT '{}'::jsonb,
    payload_summary  JSONB DEFAULT '{}'::jsonb,
    extra            JSONB DEFAULT '{}'::jsonb,
    reported_by      VARCHAR(50),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defect_save_error_logs_created_at
    ON defect_save_error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_defect_save_error_logs_pending_source
    ON defect_save_error_logs (pending_source);

CREATE INDEX IF NOT EXISTS idx_defect_save_error_logs_operation
    ON defect_save_error_logs (operation);
