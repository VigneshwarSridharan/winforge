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

CREATE TABLE IF NOT EXISTS proposals (
    id              TEXT PRIMARY KEY,
    lead_id         TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    rfp_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    error_message   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_proposal_per_lead ON proposals(lead_id);

CREATE TABLE IF NOT EXISTS proposal_sections (
    id                TEXT PRIMARY KEY,
    proposal_id       TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    order_index       INTEGER NOT NULL,
    section_title     TEXT NOT NULL,
    rfp_section_text  TEXT NOT NULL,
    exemplar_lead_id  TEXT REFERENCES leads(id) ON DELETE SET NULL,
    exemplar_text     TEXT,
    exemplar_distance REAL,
    draft_text        TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'drafting', 'completed', 'failed')),
    error_message     TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal_id ON proposal_sections(proposal_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposal_section_order
    ON proposal_sections(proposal_id, order_index);

CREATE TABLE IF NOT EXISTS proposal_validations (
    id                    TEXT PRIMARY KEY,
    lead_id               TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    proposal_document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    rfp_document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'validating', 'completed', 'failed')),
    overall_score         REAL,
    recommendation        TEXT CHECK (recommendation IN ('bid', 'no_bid', 'conditional')),
    summary               TEXT,
    error_message         TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_validation_per_proposal_doc
    ON proposal_validations(proposal_document_id);
CREATE INDEX IF NOT EXISTS idx_proposal_validations_lead_id ON proposal_validations(lead_id);

CREATE TABLE IF NOT EXISTS validation_items (
    id                TEXT PRIMARY KEY,
    validation_id     TEXT NOT NULL REFERENCES proposal_validations(id) ON DELETE CASCADE,
    order_index       INTEGER NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('requirement', 'extra_section')),
    title             TEXT NOT NULL,
    source_text       TEXT NOT NULL,
    coverage_status   TEXT CHECK (coverage_status IN ('fulfilled', 'partial', 'missing')),
    score             REAL,
    matched_text      TEXT,
    realism_notes     TEXT,
    suggestion        TEXT,
    exemplar_lead_id  TEXT REFERENCES leads(id) ON DELETE SET NULL,
    exemplar_text     TEXT,
    exemplar_distance REAL,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'evaluating', 'completed', 'failed')),
    error_message     TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_validation_items_validation_id ON validation_items(validation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_item_order
    ON validation_items(validation_id, order_index);

CREATE TABLE IF NOT EXISTS validation_suggested_sections (
    id             TEXT PRIMARY KEY,
    validation_id  TEXT NOT NULL REFERENCES proposal_validations(id) ON DELETE CASCADE,
    order_index    INTEGER NOT NULL,
    title          TEXT NOT NULL,
    rationale      TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_validation_suggested_sections_validation_id
    ON validation_suggested_sections(validation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_suggested_section_order
    ON validation_suggested_sections(validation_id, order_index);
