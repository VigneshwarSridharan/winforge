import shutil
import sqlite3

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from winforge.api import repository
from winforge.api.db import get_db
from winforge.api.ingest import ingest_document
from winforge.api.paths import chroma_dir, lead_dir, raw_path
from winforge.api.schemas import (
    DocumentOut,
    LeadCreateOut,
    LeadDetailOut,
    LeadSummaryOut,
    SearchHit,
    SearchResponse,
)
from winforge.embedding import embed_chunks
from winforge.vectorstore import delete_collection, get_collection

router = APIRouter()


def _validate_pdf(file: UploadFile) -> None:
    filename = file.filename or ""
    is_pdf = file.content_type == "application/pdf" or filename.lower().endswith(".pdf")
    if not is_pdf:
        raise HTTPException(400, "Only PDF uploads are supported")


def _get_lead_or_404(db: sqlite3.Connection, lead_id: str) -> sqlite3.Row:
    lead = repository.get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(404, "Lead not found")
    return lead


def _document_out(row: sqlite3.Row) -> DocumentOut:
    return DocumentOut(
        id=row["id"],
        doc_type=row["doc_type"],
        original_filename=row["original_filename"],
        status=row["status"],
        chunk_count=row["chunk_count"],
        error_message=row["error_message"],
        created_at=row["created_at"],
    )


def _save_upload(file: UploadFile, dest_path) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(file.file.read())


@router.post("", status_code=201, response_model=LeadCreateOut)
def create_lead(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
) -> LeadCreateOut:
    _validate_pdf(file)

    lead_id = repository.new_id()
    document_id = repository.new_id()

    repository.create_lead(db, lead_id, name)

    stored_path = raw_path(lead_id, document_id, file.filename)
    _save_upload(file, stored_path)
    repository.create_document(db, document_id, lead_id, "rfp", file.filename, str(stored_path))

    ingest_document(db, lead_id, document_id, stored_path)

    lead = repository.get_lead(db, lead_id)
    document = repository.get_document(db, document_id)
    return LeadCreateOut(id=lead["id"], name=lead["name"], status=lead["status"], rfp=_document_out(document))


@router.get("", response_model=list[LeadSummaryOut])
def list_leads(db: sqlite3.Connection = Depends(get_db)) -> list[LeadSummaryOut]:
    return [
        LeadSummaryOut(
            id=row["id"],
            name=row["name"],
            status=row["status"],
            created_at=row["created_at"],
            document_counts=repository.document_counts(db, row["id"]),
        )
        for row in repository.list_leads(db)
    ]


@router.get("/{lead_id}", response_model=LeadDetailOut)
def get_lead_detail(lead_id: str, db: sqlite3.Connection = Depends(get_db)) -> LeadDetailOut:
    lead = _get_lead_or_404(db, lead_id)
    documents = repository.list_documents(db, lead_id)
    return LeadDetailOut(
        id=lead["id"],
        name=lead["name"],
        status=lead["status"],
        created_at=lead["created_at"],
        updated_at=lead["updated_at"],
        documents=[_document_out(row) for row in documents],
    )


@router.post("/{lead_id}/documents", status_code=201, response_model=DocumentOut)
def add_document(
    lead_id: str,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
) -> DocumentOut:
    _get_lead_or_404(db, lead_id)
    if doc_type not in ("proposal", "additional"):
        raise HTTPException(
            400, "doc_type must be 'proposal' or 'additional' (rfp is only set via POST /leads)"
        )
    _validate_pdf(file)

    document_id = repository.new_id()
    stored_path = raw_path(lead_id, document_id, file.filename)
    _save_upload(file, stored_path)

    try:
        repository.create_document(db, document_id, lead_id, doc_type, file.filename, str(stored_path))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Lead already has an RFP") from None

    ingest_document(db, lead_id, document_id, stored_path)
    return _document_out(repository.get_document(db, document_id))


@router.get("/{lead_id}/documents", response_model=list[DocumentOut])
def get_documents(
    lead_id: str,
    doc_type: str | None = Query(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> list[DocumentOut]:
    _get_lead_or_404(db, lead_id)
    return [_document_out(row) for row in repository.list_documents(db, lead_id, doc_type)]


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: str, db: sqlite3.Connection = Depends(get_db)) -> None:
    lead = _get_lead_or_404(db, lead_id)
    try:
        delete_collection(chroma_dir(), lead["chroma_collection"])
    except Exception:
        # collection may never have been created if ingestion failed before the first upsert
        pass
    shutil.rmtree(lead_dir(lead_id), ignore_errors=True)
    repository.delete_lead(db, lead_id)


@router.get("/{lead_id}/search", response_model=SearchResponse)
def search_lead(
    lead_id: str,
    q: str = Query(...),
    n_results: int = Query(default=5, ge=1),
    db: sqlite3.Connection = Depends(get_db),
) -> SearchResponse:
    lead = _get_lead_or_404(db, lead_id)
    if not q.strip():
        raise HTTPException(400, "q must not be empty")

    query_embedding = embed_chunks([{"text": q}])[0]
    collection = get_collection(chroma_dir(), lead["chroma_collection"])
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    hits = [
        SearchHit(id=id_, text=text, metadata=metadata, distance=distance)
        for id_, text, metadata, distance in zip(
            results["ids"][0],
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]
    return SearchResponse(query=q, results=hits)
