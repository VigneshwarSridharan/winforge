import sqlite3
from pathlib import Path

from winforge.api import db as db_module
from winforge.api import repository
from winforge.api.paths import chroma_dir
from winforge.api.proposal_generation import other_lead_contexts
from winforge.embedding import embed_chunks
from winforge.proposal import find_exemplar, load_rfp_sections
from winforge.validation import (
    EXTRA_SECTION_MAX_DISTANCE,
    assess_extra_section,
    assess_requirement,
    find_proposal_matches,
    find_rfp_match,
    synthesize_assessment,
)


def _other_lead_proposal_sections(db: sqlite3.Connection, other_leads: list[dict]) -> list[dict]:
    sections = []
    for lead in other_leads:
        if not lead["proposal_filenames"]:
            continue
        proposal_docs = [
            d
            for d in repository.list_documents(db, lead["id"], "proposal")
            if d["status"] == "indexed" and d["chunks_path"]
        ]
        for doc in proposal_docs:
            try:
                doc_sections = load_rfp_sections(Path(doc["chunks_path"]))
            except Exception:
                continue
            for section in doc_sections:
                sections.append({"lead_name": lead["name"], "section_title": section["title"]})
    return sections


def validate_proposal(
    db: sqlite3.Connection, lead_id: str, proposal_document_id: str, rfp_document_id: str
) -> None:
    """Validate one proposal document against its lead's RFP, item by item.

    Never raises: failures are recorded on the validation/item rows so the background
    task always completes cleanly, mirroring proposal_generation.py's philosophy.
    """
    validation_id = repository.new_id()
    try:
        repository.create_proposal_validation(
            db, validation_id, lead_id, proposal_document_id, rfp_document_id
        )
    except sqlite3.IntegrityError:
        return  # a validation already exists for this proposal document

    rfp_document = repository.get_document(db, rfp_document_id)
    proposal_document = repository.get_document(db, proposal_document_id)
    if (
        rfp_document is None
        or rfp_document["status"] != "indexed"
        or not rfp_document["chunks_path"]
        or proposal_document is None
        or proposal_document["status"] != "indexed"
        or not proposal_document["chunks_path"]
    ):
        repository.mark_validation_failed(db, validation_id, "RFP or proposal was not indexed.")
        return

    try:
        rfp_sections = load_rfp_sections(Path(rfp_document["chunks_path"]))
        proposal_sections = load_rfp_sections(Path(proposal_document["chunks_path"]))
    except Exception as exc:
        repository.mark_validation_failed(db, validation_id, str(exc))
        return
    if not rfp_sections:
        repository.mark_validation_failed(db, validation_id, "RFP had no extractable sections.")
        return

    repository.mark_validation_validating(db, validation_id)
    lead = repository.get_lead(db, lead_id)
    other_leads = other_lead_contexts(db, lead_id)
    rfp_filename = Path(rfp_document["stored_path"]).name
    proposal_filename = Path(proposal_document["stored_path"]).name
    collection_name = lead["chroma_collection"]

    # --- requirement items: does the proposal cover each RFP ask? ---
    requirement_ids = [repository.new_id() for _ in rfp_sections]
    for order_index, (item_id, section) in enumerate(zip(requirement_ids, rfp_sections)):
        repository.create_validation_item(
            db, item_id, validation_id, order_index, "requirement", section["title"], section["text"]
        )

    completed_requirements = []
    for item_id, section in zip(requirement_ids, rfp_sections):
        repository.mark_item_evaluating(db, item_id)
        try:
            query_embedding = embed_chunks([{"text": section["text"]}])[0]
            matches = find_proposal_matches(
                query_embedding, chroma_dir(), collection_name, proposal_filename
            )
            exemplar = find_exemplar(query_embedding, chroma_dir(), other_leads)
            assessment = assess_requirement(
                lead["name"], section["title"], section["text"], matches, exemplar
            )
            repository.mark_item_completed(
                db,
                item_id,
                coverage_status=assessment.coverage_status,
                score=assessment.score,
                matched_text=matches[0]["text"] if matches else None,
                realism_notes=assessment.realism_notes,
                suggestion=assessment.suggestion,
                exemplar_lead_id=exemplar["lead_id"] if exemplar else None,
                exemplar_text=exemplar["text"] if exemplar else None,
                exemplar_distance=exemplar["distance"] if exemplar else None,
            )
            completed_requirements.append(
                {
                    "title": section["title"],
                    "coverage_status": assessment.coverage_status,
                    "score": assessment.score,
                    "realism_notes": assessment.realism_notes,
                }
            )
        except Exception as exc:
            repository.mark_item_failed(db, item_id, str(exc))
            # continue to next item regardless -- per-item isolation

    # --- extra-section detection: proposal sections the RFP never asked for ---
    extra_candidates = []
    for section in proposal_sections:
        try:
            query_embedding = embed_chunks([{"text": section["text"]}])[0]
            rfp_match = find_rfp_match(query_embedding, chroma_dir(), collection_name, rfp_filename)
        except Exception:
            continue  # can't assess this section's mapping; skip rather than mis-flag
        if rfp_match is None or rfp_match["distance"] > EXTRA_SECTION_MAX_DISTANCE:
            extra_candidates.append(section)

    base_order = len(rfp_sections)
    extra_ids = [repository.new_id() for _ in extra_candidates]
    for offset, (item_id, section) in enumerate(zip(extra_ids, extra_candidates)):
        repository.create_validation_item(
            db,
            item_id,
            validation_id,
            base_order + offset,
            "extra_section",
            section["title"],
            section["text"],
        )

    completed_extras = []
    for item_id, section in zip(extra_ids, extra_candidates):
        repository.mark_item_evaluating(db, item_id)
        try:
            note = assess_extra_section(section["title"], section["text"])
            repository.mark_item_completed(db, item_id, realism_notes=note)
            completed_extras.append({"title": section["title"], "note": note})
        except Exception as exc:
            repository.mark_item_failed(db, item_id, str(exc))

    # --- synthesis: overall score, recommendation, suggested additional sections ---
    try:
        other_sections = _other_lead_proposal_sections(db, other_leads)
        overall = synthesize_assessment(
            lead["name"], completed_requirements, completed_extras, other_sections
        )
        repository.mark_validation_completed(
            db, validation_id, overall.overall_score, overall.recommendation, overall.summary
        )
        for order_index, s in enumerate(overall.suggested_sections):
            repository.create_validation_suggested_section(
                db, repository.new_id(), validation_id, order_index, s.title, s.rationale
            )
    except Exception as exc:
        repository.mark_validation_failed(db, validation_id, str(exc))


def run_proposal_validation(lead_id: str, proposal_document_id: str, rfp_document_id: str) -> None:
    db = db_module.connect()
    try:
        validate_proposal(db, lead_id, proposal_document_id, rfp_document_id)
    finally:
        db.close()
