CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE datasets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    row_count INTEGER,
    column_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dataset_columns (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    missing_count INTEGER NOT NULL DEFAULT 0,
    unique_count INTEGER
);

CREATE TABLE experiments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    dataset_id UUID NOT NULL REFERENCES datasets (id),
    status TEXT NOT NULL,
    task_type TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
    id UUID PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES experiments (id),
    dataset_id UUID NOT NULL REFERENCES datasets (id),
    user_id UUID NOT NULL REFERENCES users (id),
    algorithm TEXT NOT NULL,
    task_type TEXT NOT NULL,
    target_column TEXT NOT NULL,
    feature_columns TEXT[] NOT NULL,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    artifact_path TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_metrics (
    id UUID PRIMARY KEY,
    model_id UUID NOT NULL REFERENCES models (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE predictions (
    id UUID PRIMARY KEY,
    model_id UUID NOT NULL REFERENCES models (id),
    user_id UUID NOT NULL REFERENCES users (id),
    input JSONB NOT NULL,
    output JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users (id),
    experiment_id UUID REFERENCES experiments (id),
    trace_id TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users (id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX datasets_user_id_idx ON datasets (user_id);
CREATE INDEX experiments_user_id_idx ON experiments (user_id);
CREATE INDEX models_user_id_idx ON models (user_id);
CREATE INDEX predictions_user_id_idx ON predictions (user_id);
