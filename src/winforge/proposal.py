import json
from pathlib import Path

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from pydantic import BaseModel

from winforge.vectorstore import get_collection

DRAFTING_MODEL = "gpt-5-mini"

# l2 distance (Chroma's default space) below which a cross-lead RFP section match is
# treated as "similar enough" to reuse its lead's proposal as an exemplar. Calibrated
# empirically against the sample leads -- see the plan's verification step.
MAX_MATCH_DISTANCE = 0.35

DRAFTING_INSTRUCTIONS = (
    'You are drafting one section of a proposal document in response to an RFP for '
    'the prospective client "{lead_name}". Write only the body text for this section '
    "-- do not repeat the section title as a heading.\n\n"
    "RFP section this proposal section must respond to:\n---\n{rfp_section_text}\n---\n\n"
    "{exemplar_block}"
)


class DraftedSection(BaseModel):
    text: str


def load_rfp_sections(chunks_json_path: Path) -> list[dict]:
    """Group a document's stored chunks into ordered, merged sections.

    Returns [{"title": str, "text": str}, ...] in original document order, with
    multi-chunk sections merged into a single text block.
    """
    chunks = json.loads(Path(chunks_json_path).read_text())
    chunks.sort(key=lambda c: c["metadata"]["chunk"])

    sections: list[dict] = []
    current_title = None
    for chunk in chunks:
        title = chunk["metadata"]["section"]
        text = chunk["text"]
        if title == current_title:
            prefix = f"{title}\n\n"
            body = text[len(prefix):] if text.startswith(prefix) else text
            sections[-1]["text"] += "\n\n" + body
        else:
            sections.append({"title": title, "text": text})
            current_title = title
    return sections


def find_exemplar(
    query_embedding: list[float], chroma_dir: Path, other_leads: list[dict]
) -> dict | None:
    """Search other active leads' RFP chunks for the closest match to query_embedding,
    then fetch that lead's own uploaded proposal text for the matched topic.

    other_leads: [{"id", "name", "chroma_collection", "rfp_filename", "proposal_filenames"}, ...]
    """
    best = None
    for lead in other_leads:
        if not lead["rfp_filename"]:
            continue
        collection = get_collection(chroma_dir, lead["chroma_collection"])
        try:
            res = collection.query(
                query_embeddings=[query_embedding],
                n_results=1,
                where={"document": lead["rfp_filename"]},
                include=["documents", "metadatas", "distances"],
            )
        except Exception:
            continue
        if not res["ids"][0]:
            continue
        distance = res["distances"][0][0]
        if best is None or distance < best["distance"]:
            best = {"lead": lead, "distance": distance}

    if best is None or best["distance"] > MAX_MATCH_DISTANCE:
        return None
    return _fetch_exemplar(query_embedding, chroma_dir, best["lead"], best["distance"])


def _fetch_exemplar(
    query_embedding: list[float], chroma_dir: Path, lead: dict, rfp_match_distance: float
) -> dict | None:
    if not lead["proposal_filenames"]:
        return None
    collection = get_collection(chroma_dir, lead["chroma_collection"])
    res = collection.query(
        query_embeddings=[query_embedding],
        n_results=1,
        where={"document": {"$in": lead["proposal_filenames"]}},
        include=["documents", "metadatas", "distances"],
    )
    if not res["ids"][0]:
        return None
    return {
        "lead_id": lead["id"],
        "lead_name": lead["name"],
        "text": res["documents"][0][0],
        "distance": rfp_match_distance,
    }


def draft_section(
    lead_name: str, section_title: str, rfp_section_text: str, exemplar: dict | None
) -> str:
    exemplar_block = (
        "Reference exemplar -- a section from a proposal that won a similar past RFP "
        "(match this tone and structure; adapt facts, don't copy verbatim):\n---\n"
        f"{exemplar['text']}\n---\n"
        if exemplar
        else "No reference exemplar was found for this section; draft using general "
        "proposal-writing best practice."
    )
    prompt = DRAFTING_INSTRUCTIONS.format(
        lead_name=lead_name, rfp_section_text=rfp_section_text, exemplar_block=exemplar_block
    )
    agent = Agent(model=OpenAIChat(id=DRAFTING_MODEL), output_schema=DraftedSection)
    result = agent.run(f"Section: {section_title}\n\n{prompt}").content
    return result.text
