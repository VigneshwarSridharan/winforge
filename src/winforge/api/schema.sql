PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'deleted')),
    chroma_collection TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id                TEXT PRIMARY KEY,
    lead_id           TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    doc_type          TEXT NOT NULL CHECK (doc_type IN ('rfp', 'proposal', 'additional')),
    original_filename TEXT NOT NULL,
    stored_path       TEXT NOT NULL,
    chunks_path       TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'indexed', 'failed')),
    chunk_count       INTEGER,
    error_message     TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_rfp_per_lead
    ON documents(lead_id) WHERE doc_type = 'rfp';
