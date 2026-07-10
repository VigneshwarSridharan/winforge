import sqlite3
import uuid
from datetime import datetime, timezone

from winforge.api.paths import collection_name


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def create_lead(db: sqlite3.Connection, lead_id: str, name: str) -> None:
    now = _now()
    db.execute(
        "INSERT INTO leads (id, name, status, chroma_collection, created_at, updated_at) "
        "VALUES (?, ?, 'active', ?, ?, ?)",
        (lead_id, name, collection_name(lead_id), now, now),
    )
    db.commit()


def get_lead(db: sqlite3.Connection, lead_id: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM leads WHERE id = ? AND status = 'active'", (lead_id,)
    ).fetchone()


def list_leads(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM leads WHERE status = 'active' ORDER BY created_at DESC"
    ).fetchall()


def delete_lead(db: sqlite3.Connection, lead_id: str) -> None:
    db.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    db.commit()


def document_counts(db: sqlite3.Connection, lead_id: str) -> dict[str, int]:
    rows = db.execute(
        "SELECT doc_type, COUNT(*) AS n FROM documents WHERE lead_id = ? GROUP BY doc_type",
        (lead_id,),
    ).fetchall()
    counts = {"rfp": 0, "proposal": 0, "additional": 0}
    for row in rows:
        counts[row["doc_type"]] = row["n"]
    return counts


def create_document(
    db: sqlite3.Connection,
    document_id: str,
    lead_id: str,
    doc_type: str,
    original_filename: str,
    stored_path: str,
) -> None:
    now = _now()
    db.execute(
        "INSERT INTO documents "
        "(id, lead_id, doc_type, original_filename, stored_path, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
        (document_id, lead_id, doc_type, original_filename, stored_path, now, now),
    )
    db.commit()


def mark_document_processing(db: sqlite3.Connection, document_id: str) -> None:
    db.execute(
        "UPDATE documents SET status = 'processing', updated_at = ? WHERE id = ?",
        (_now(), document_id),
    )
    db.commit()


def mark_document_indexed(
    db: sqlite3.Connection, document_id: str, chunks_path: str, chunk_count: int
) -> None:
    db.execute(
        "UPDATE documents SET status = 'indexed', chunks_path = ?, chunk_count = ?, "
        "updated_at = ? WHERE id = ?",
        (chunks_path, chunk_count, _now(), document_id),
    )
    db.commit()


def mark_document_failed(db: sqlite3.Connection, document_id: str, error_message: str) -> None:
    db.execute(
        "UPDATE documents SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
        (error_message[:500], _now(), document_id),
    )
    db.commit()


def get_document(db: sqlite3.Connection, document_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()


def list_documents(
    db: sqlite3.Connection, lead_id: str, doc_type: str | None = None
) -> list[sqlite3.Row]:
    if doc_type is not None:
        return db.execute(
            "SELECT * FROM documents WHERE lead_id = ? AND doc_type = ? ORDER BY created_at",
            (lead_id, doc_type),
        ).fetchall()
    return db.execute(
        "SELECT * FROM documents WHERE lead_id = ? ORDER BY created_at", (lead_id,)
    ).fetchall()


def create_proposal(
    db: sqlite3.Connection, proposal_id: str, lead_id: str, rfp_document_id: str
) -> None:
    now = _now()
    db.execute(
        "INSERT INTO proposals (id, lead_id, rfp_document_id, status, created_at, updated_at) "
        "VALUES (?, ?, ?, 'pending', ?, ?)",
        (proposal_id, lead_id, rfp_document_id, now, now),
    )
    db.commit()


def get_proposal_by_lead(db: sqlite3.Connection, lead_id: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM proposals WHERE lead_id = ?", (lead_id,)
    ).fetchone()


def mark_proposal_generating(db: sqlite3.Connection, proposal_id: str) -> None:
    db.execute(
        "UPDATE proposals SET status = 'generating', updated_at = ? WHERE id = ?",
        (_now(), proposal_id),
    )
    db.commit()


def mark_proposal_completed(db: sqlite3.Connection, proposal_id: str) -> None:
    db.execute(
        "UPDATE proposals SET status = 'completed', updated_at = ? WHERE id = ?",
        (_now(), proposal_id),
    )
    db.commit()


def mark_proposal_failed(db: sqlite3.Connection, proposal_id: str, error_message: str) -> None:
    db.execute(
        "UPDATE proposals SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
        (error_message[:500], _now(), proposal_id),
    )
    db.commit()


def create_proposal_section(
    db: sqlite3.Connection,
    section_id: str,
    proposal_id: str,
    order_index: int,
    section_title: str,
    rfp_section_text: str,
) -> None:
    now = _now()
    db.execute(
        "INSERT INTO proposal_sections "
        "(id, proposal_id, order_index, section_title, rfp_section_text, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
        (section_id, proposal_id, order_index, section_title, rfp_section_text, now, now),
    )
    db.commit()


def mark_section_drafting(db: sqlite3.Connection, section_id: str) -> None:
    db.execute(
        "UPDATE proposal_sections SET status = 'drafting', updated_at = ? WHERE id = ?",
        (_now(), section_id),
    )
    db.commit()


def mark_section_completed(
    db: sqlite3.Connection,
    section_id: str,
    draft_text: str,
    exemplar_lead_id: str | None,
    exemplar_text: str | None,
    exemplar_distance: float | None,
) -> None:
    db.execute(
        "UPDATE proposal_sections SET status = 'completed', draft_text = ?, "
        "exemplar_lead_id = ?, exemplar_text = ?, exemplar_distance = ?, updated_at = ? "
        "WHERE id = ?",
        (draft_text, exemplar_lead_id, exemplar_text, exemplar_distance, _now(), section_id),
    )
    db.commit()


def mark_section_failed(db: sqlite3.Connection, section_id: str, error_message: str) -> None:
    db.execute(
        "UPDATE proposal_sections SET status = 'failed', error_message = ?, updated_at = ? "
        "WHERE id = ?",
        (error_message[:500], _now(), section_id),
    )
    db.commit()


def list_proposal_sections(db: sqlite3.Connection, proposal_id: str) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT ps.*, l.name AS exemplar_lead_name "
        "FROM proposal_sections ps "
        "LEFT JOIN leads l ON l.id = ps.exemplar_lead_id "
        "WHERE ps.proposal_id = ? "
        "ORDER BY ps.order_index",
        (proposal_id,),
    ).fetchall()


def create_proposal_validation(
    db: sqlite3.Connection,
    validation_id: str,
    lead_id: str,
    proposal_document_id: str,
    rfp_document_id: str,
) -> None:
    now = _now()
    db.execute(
        "INSERT INTO proposal_validations "
        "(id, lead_id, proposal_document_id, rfp_document_id, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        (validation_id, lead_id, proposal_document_id, rfp_document_id, now, now),
    )
    db.commit()


def get_validation_by_document(
    db: sqlite3.Connection, proposal_document_id: str
) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM proposal_validations WHERE proposal_document_id = ?",
        (proposal_document_id,),
    ).fetchone()


def mark_validation_validating(db: sqlite3.Connection, validation_id: str) -> None:
    db.execute(
        "UPDATE proposal_validations SET status = 'validating', updated_at = ? WHERE id = ?",
        (_now(), validation_id),
    )
    db.commit()


def mark_validation_completed(
    db: sqlite3.Connection,
    validation_id: str,
    overall_score: float,
    recommendation: str,
    summary: str,
) -> None:
    db.execute(
        "UPDATE proposal_validations SET status = 'completed', overall_score = ?, "
        "recommendation = ?, summary = ?, updated_at = ? WHERE id = ?",
        (overall_score, recommendation, summary, _now(), validation_id),
    )
    db.commit()


def mark_validation_failed(db: sqlite3.Connection, validation_id: str, error_message: str) -> None:
    db.execute(
        "UPDATE proposal_validations SET status = 'failed', error_message = ?, updated_at = ? "
        "WHERE id = ?",
        (error_message[:500], _now(), validation_id),
    )
    db.commit()


def create_validation_item(
    db: sqlite3.Connection,
    item_id: str,
    validation_id: str,
    order_index: int,
    kind: str,
    title: str,
    source_text: str,
) -> None:
    now = _now()
    db.execute(
        "INSERT INTO validation_items "
        "(id, validation_id, order_index, kind, title, source_text, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
        (item_id, validation_id, order_index, kind, title, source_text, now, now),
    )
    db.commit()


def mark_item_evaluating(db: sqlite3.Connection, item_id: str) -> None:
    db.execute(
        "UPDATE validation_items SET status = 'evaluating', updated_at = ? WHERE id = ?",
        (_now(), item_id),
    )
    db.commit()


def mark_item_completed(
    db: sqlite3.Connection,
    item_id: str,
    *,
    coverage_status: str | None = None,
    score: float | None = None,
    matched_text: str | None = None,
    realism_notes: str | None = None,
    suggestion: str | None = None,
    exemplar_lead_id: str | None = None,
    exemplar_text: str | None = None,
    exemplar_distance: float | None = None,
) -> None:
    db.execute(
        "UPDATE validation_items SET status = 'completed', coverage_status = ?, score = ?, "
        "matched_text = ?, realism_notes = ?, suggestion = ?, exemplar_lead_id = ?, "
        "exemplar_text = ?, exemplar_distance = ?, updated_at = ? WHERE id = ?",
        (
            coverage_status,
            score,
            matched_text,
            realism_notes,
            suggestion,
            exemplar_lead_id,
            exemplar_text,
            exemplar_distance,
            _now(),
            item_id,
        ),
    )
    db.commit()


def mark_item_failed(db: sqlite3.Connection, item_id: str, error_message: str) -> None:
    db.execute(
        "UPDATE validation_items SET status = 'failed', error_message = ?, updated_at = ? "
        "WHERE id = ?",
        (error_message[:500], _now(), item_id),
    )
    db.commit()


def list_validation_items(db: sqlite3.Connection, validation_id: str) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT vi.*, l.name AS exemplar_lead_name "
        "FROM validation_items vi "
        "LEFT JOIN leads l ON l.id = vi.exemplar_lead_id "
        "WHERE vi.validation_id = ? "
        "ORDER BY vi.order_index",
        (validation_id,),
    ).fetchall()


def create_validation_suggested_section(
    db: sqlite3.Connection,
    suggestion_id: str,
    validation_id: str,
    order_index: int,
    title: str,
    rationale: str | None,
) -> None:
    db.execute(
        "INSERT INTO validation_suggested_sections "
        "(id, validation_id, order_index, title, rationale, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (suggestion_id, validation_id, order_index, title, rationale, _now()),
    )
    db.commit()


def list_validation_suggested_sections(
    db: sqlite3.Connection, validation_id: str
) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM validation_suggested_sections WHERE validation_id = ? ORDER BY order_index",
        (validation_id,),
    ).fetchall()
