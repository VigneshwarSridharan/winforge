import shutil
import sqlite3

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response

from winforge.api import repository
from winforge.api.db import get_db
from winforge.api.ingest import ingest_document
from winforge.api.paths import chroma_dir, lead_dir, raw_path
from winforge.api.proposal_generation import run_proposal_generation
from winforge.api.proposal_validation import run_proposal_validation
from winforge.api.schemas import (
    DocumentOut,
    LeadCreateOut,
    LeadDetailOut,
    LeadSummaryOut,
    ProposalOut,
    ProposalSectionOut,
    ProposalValidationOut,
    SearchHit,
    SearchResponse,
    SuggestedSectionOut,
    ValidationItemOut,
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
    background_tasks: BackgroundTasks,
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
    if document["status"] == "indexed":
        background_tasks.add_task(run_proposal_generation, lead_id, document_id)
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
    background_tasks: BackgroundTasks,
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
    document = repository.get_document(db, document_id)

    if doc_type == "proposal" and document["status"] == "indexed":
        rfp_docs = repository.list_documents(db, lead_id, "rfp")
        rfp_document = rfp_docs[0] if rfp_docs else None
        if rfp_document is not None and rfp_document["status"] == "indexed":
            background_tasks.add_task(
                run_proposal_validation, lead_id, document_id, rfp_document["id"]
            )

    return _document_out(document)


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


def _proposal_out(proposal: sqlite3.Row, sections: list[sqlite3.Row]) -> ProposalOut:
    return ProposalOut(
        id=proposal["id"],
        lead_id=proposal["lead_id"],
        status=proposal["status"],
        error_message=proposal["error_message"],
        created_at=proposal["created_at"],
        updated_at=proposal["updated_at"],
        sections=[
            ProposalSectionOut(
                id=s["id"],
                order_index=s["order_index"],
                section_title=s["section_title"],
                status=s["status"],
                draft_text=s["draft_text"],
                exemplar_lead_id=s["exemplar_lead_id"],
                exemplar_lead_name=s["exemplar_lead_name"],
                exemplar_distance=s["exemplar_distance"],
                error_message=s["error_message"],
            )
            for s in sections
        ],
    )


@router.get("/{lead_id}/proposal", response_model=ProposalOut)
def get_proposal(lead_id: str, db: sqlite3.Connection = Depends(get_db)) -> ProposalOut:
    _get_lead_or_404(db, lead_id)
    proposal = repository.get_proposal_by_lead(db, lead_id)
    if proposal is None:
        raise HTTPException(404, "Proposal has not been generated for this lead yet")
    return _proposal_out(proposal, repository.list_proposal_sections(db, proposal["id"]))


@router.get("/{lead_id}/proposal/export")
def export_proposal(lead_id: str, db: sqlite3.Connection = Depends(get_db)) -> Response:
    lead = _get_lead_or_404(db, lead_id)
    proposal = repository.get_proposal_by_lead(db, lead_id)
    if proposal is None:
        raise HTTPException(404, "Proposal has not been generated for this lead yet")
    sections = repository.list_proposal_sections(db, proposal["id"])

    lines = [f"# Proposal Draft — {lead['name']}", ""]
    for s in sections:
        lines.append(f"## {s['section_title']}")
        lines.append("")
        lines.append(s["draft_text"] if s["draft_text"] else "*This section failed to generate.*")
        lines.append("")
    md = "\n".join(lines)

    safe_name = "".join(c if c.isalnum() else "_" for c in lead["name"])
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_proposal_draft.md"'},
    )


def _proposal_validation_out(
    validation: sqlite3.Row, items: list[sqlite3.Row], suggestions: list[sqlite3.Row]
) -> ProposalValidationOut:
    return ProposalValidationOut(
        id=validation["id"],
        lead_id=validation["lead_id"],
        proposal_document_id=validation["proposal_document_id"],
        rfp_document_id=validation["rfp_document_id"],
        status=validation["status"],
        overall_score=validation["overall_score"],
        recommendation=validation["recommendation"],
        summary=validation["summary"],
        error_message=validation["error_message"],
        created_at=validation["created_at"],
        updated_at=validation["updated_at"],
        items=[
            ValidationItemOut(
                id=i["id"],
                order_index=i["order_index"],
                kind=i["kind"],
                title=i["title"],
                source_text=i["source_text"],
                coverage_status=i["coverage_status"],
                score=i["score"],
                matched_text=i["matched_text"],
                realism_notes=i["realism_notes"],
                suggestion=i["suggestion"],
                exemplar_lead_id=i["exemplar_lead_id"],
                exemplar_lead_name=i["exemplar_lead_name"],
                exemplar_distance=i["exemplar_distance"],
                status=i["status"],
                error_message=i["error_message"],
            )
            for i in items
        ],
        suggested_sections=[
            SuggestedSectionOut(
                id=s["id"], order_index=s["order_index"], title=s["title"], rationale=s["rationale"]
            )
            for s in suggestions
        ],
    )


@router.get(
    "/{lead_id}/proposal-validation/{document_id}", response_model=ProposalValidationOut
)
def get_proposal_validation(
    lead_id: str, document_id: str, db: sqlite3.Connection = Depends(get_db)
) -> ProposalValidationOut:
    _get_lead_or_404(db, lead_id)
    validation = repository.get_validation_by_document(db, document_id)
    if validation is None or validation["lead_id"] != lead_id:
        raise HTTPException(404, "No validation found for this document")
    return _proposal_validation_out(
        validation,
        repository.list_validation_items(db, validation["id"]),
        repository.list_validation_suggested_sections(db, validation["id"]),
    )
