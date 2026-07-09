import sqlite3
from pathlib import Path

from winforge.api import repository
from winforge.api.paths import chroma_dir, collection_name, content_path
from winforge.pipeline import index_document


def ingest_document(db: sqlite3.Connection, lead_id: str, document_id: str, pdf_path: Path) -> None:
    """Run the convert/chunk/embed/upsert pipeline for one document.

    Never raises: ingestion failures are recorded on the document row (status='failed')
    so the lead/document creation request can still return a 2xx response.
    """
    repository.mark_document_processing(db, document_id)
    chunks_json = content_path(lead_id, document_id)
    try:
        chunks = index_document(pdf_path, chroma_dir(), collection_name(lead_id), chunks_json)
    except Exception as exc:
        repository.mark_document_failed(db, document_id, str(exc))
        return

    repository.mark_document_indexed(db, document_id, str(chunks_json), len(chunks))
