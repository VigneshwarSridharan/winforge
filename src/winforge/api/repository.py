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
