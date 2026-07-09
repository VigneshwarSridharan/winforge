import sqlite3
from pathlib import Path

from winforge.api import db as db_module
from winforge.api import repository
from winforge.api.paths import chroma_dir
from winforge.embedding import embed_chunks
from winforge.proposal import draft_section, find_exemplar, load_rfp_sections


def _other_lead_contexts(db: sqlite3.Connection, exclude_lead_id: str) -> list[dict]:
    contexts = []
    for lead in repository.list_leads(db):
        if lead["id"] == exclude_lead_id:
            continue
        rfp_docs = [
            d for d in repository.list_documents(db, lead["id"], "rfp") if d["status"] == "indexed"
        ]
        proposal_docs = [
            d
            for d in repository.list_documents(db, lead["id"], "proposal")
            if d["status"] == "indexed"
        ]
        contexts.append(
            {
                "id": lead["id"],
                "name": lead["name"],
                "chroma_collection": lead["chroma_collection"],
                "rfp_filename": Path(rfp_docs[0]["stored_path"]).name if rfp_docs else None,
                "proposal_filenames": [Path(d["stored_path"]).name for d in proposal_docs],
            }
        )
    return contexts


def generate_proposal(db: sqlite3.Connection, lead_id: str, rfp_document_id: str) -> None:
    """Draft a full proposal for a lead's RFP, section by section.

    Never raises: failures are recorded on the proposal/section rows so the background
    task always completes cleanly, mirroring ingest.py's philosophy.
    """
    proposal_id = repository.new_id()
    try:
        repository.create_proposal(db, proposal_id, lead_id, rfp_document_id)
    except sqlite3.IntegrityError:
        return  # a proposal already exists for this lead (v1: one draft per lead)

    rfp_document = repository.get_document(db, rfp_document_id)
    if rfp_document is None or rfp_document["status"] != "indexed" or not rfp_document["chunks_path"]:
        repository.mark_proposal_failed(db, proposal_id, "RFP was not indexed; nothing to draft from.")
        return

    try:
        sections = load_rfp_sections(Path(rfp_document["chunks_path"]))
    except Exception as exc:
        repository.mark_proposal_failed(db, proposal_id, str(exc))
        return
    if not sections:
        repository.mark_proposal_failed(db, proposal_id, "RFP had no extractable sections.")
        return

    repository.mark_proposal_generating(db, proposal_id)
    lead = repository.get_lead(db, lead_id)
    other_leads = _other_lead_contexts(db, lead_id)

    section_ids = [repository.new_id() for _ in sections]
    for order_index, (section_id, section) in enumerate(zip(section_ids, sections)):
        repository.create_proposal_section(
            db, section_id, proposal_id, order_index, section["title"], section["text"]
        )

    for section_id, section in zip(section_ids, sections):
        repository.mark_section_drafting(db, section_id)
        try:
            query_embedding = embed_chunks([{"text": section["text"]}])[0]
            exemplar = find_exemplar(query_embedding, chroma_dir(), other_leads)
            draft_text = draft_section(lead["name"], section["title"], section["text"], exemplar)
            repository.mark_section_completed(
                db,
                section_id,
                draft_text,
                exemplar_lead_id=exemplar["lead_id"] if exemplar else None,
                exemplar_text=exemplar["text"] if exemplar else None,
                exemplar_distance=exemplar["distance"] if exemplar else None,
            )
        except Exception as exc:
            repository.mark_section_failed(db, section_id, str(exc))
            # continue to next section regardless -- per-section isolation

    repository.mark_proposal_completed(db, proposal_id)


def run_proposal_generation(lead_id: str, rfp_document_id: str) -> None:
    db = db_module.connect()
    try:
        generate_proposal(db, lead_id, rfp_document_id)
    finally:
        db.close()
