from pathlib import Path
from typing import Literal

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from pydantic import BaseModel

from winforge.vectorstore import get_collection

VALIDATION_MODEL = "gpt-5-mini"

# l2 distance above which a proposal section is flagged as not corresponding to any RFP
# chunk. Deliberately much looser than proposal.MAX_MATCH_DISTANCE (0.35): that value is
# calibrated for RFP-to-RFP topic matching (same register, two RFPs), whereas this
# compares an RFP ask (formal request language) against a proposal answer (prose) --
# measured against real sample docs, matching section pairs land in the 0.29-0.63 range
# even when clearly responsive, vs. 0.7+ for genuine boilerplate/no-counterpart sections.
EXTRA_SECTION_MAX_DISTANCE = 0.7


class RequirementAssessment(BaseModel):
    coverage_status: Literal["fulfilled", "partial", "missing"]
    score: float
    realism_notes: str
    suggestion: str | None


class ExtraSectionNote(BaseModel):
    note: str


class SuggestedSection(BaseModel):
    title: str
    rationale: str


class OverallAssessment(BaseModel):
    overall_score: float
    recommendation: Literal["bid", "no_bid", "conditional"]
    summary: str
    suggested_sections: list[SuggestedSection]


REQUIREMENT_INSTRUCTIONS = (
    'You are reviewing a proposal document written in response to an RFP for the '
    'prospective client "{lead_name}". Assess whether the proposal adequately addresses '
    "one specific RFP requirement.\n\n"
    "RFP requirement:\n---\n{rfp_section_text}\n---\n\n"
    "{matches_block}"
    "{exemplar_block}"
    "Judge coverage_status as 'fulfilled' if the proposal makes a specific, substantive "
    "commitment addressing the requirement; 'partial' if it's mentioned but vague, "
    "incomplete, or hand-wavy; 'missing' if the proposal excerpts don't address it at "
    "all. score is 0-100 reflecting how fully and concretely the requirement is met. "
    "realism_notes should call out whether the proposal's claims are specific and "
    "credible or generic boilerplate/unrealistic. suggestion should be null when "
    "coverage_status is 'fulfilled', otherwise a concrete, actionable suggestion for "
    "what to add or fix."
)

NO_MATCHES_BLOCK = "The proposal contains no excerpts that appear related to this requirement.\n\n"


def _matches_block(matches: list[dict]) -> str:
    if not matches:
        return NO_MATCHES_BLOCK
    excerpts = "\n---\n".join(m["text"] for m in matches)
    return f"Closest matching excerpt(s) from the proposal:\n---\n{excerpts}\n---\n\n"


def _exemplar_block(exemplar: dict | None) -> str:
    if not exemplar:
        return ""
    return (
        "For reference, here is how a proposal that won a similar past RFP addressed "
        f"the same topic (use only to inform the suggestion, don't assume it applies "
        f"verbatim):\n---\n{exemplar['text']}\n---\n\n"
    )


def find_proposal_matches(
    query_embedding: list[float],
    chroma_dir: Path,
    collection_name: str,
    proposal_filename: str,
    n_results: int = 3,
) -> list[dict]:
    """Search the lead's own collection, scoped to its proposal document, for the
    excerpts most relevant to one RFP requirement.

    Returns [{"text", "distance", "section", "page"}, ...] ordered by distance, or []
    if the proposal document has no matching chunks.
    """
    collection = get_collection(chroma_dir, collection_name)
    try:
        res = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where={"document": proposal_filename},
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []
    if not res["ids"][0]:
        return []
    return [
        {
            "text": text,
            "distance": distance,
            "section": metadata.get("section"),
            "page": metadata.get("page"),
        }
        for text, metadata, distance in zip(
            res["documents"][0], res["metadatas"][0], res["distances"][0]
        )
    ]


def find_rfp_match(
    query_embedding: list[float], chroma_dir: Path, collection_name: str, rfp_filename: str
) -> dict | None:
    """Reverse lookup: closest RFP chunk to one proposal section, within the same
    lead's collection. Used to detect proposal sections the RFP never asked for.
    """
    collection = get_collection(chroma_dir, collection_name)
    try:
        res = collection.query(
            query_embeddings=[query_embedding],
            n_results=1,
            where={"document": rfp_filename},
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return None
    if not res["ids"][0]:
        return None
    return {
        "text": res["documents"][0][0],
        "distance": res["distances"][0][0],
        "section": res["metadatas"][0][0].get("section"),
    }


def assess_requirement(
    lead_name: str,
    rfp_section_title: str,
    rfp_section_text: str,
    proposal_matches: list[dict],
    exemplar: dict | None,
) -> RequirementAssessment:
    prompt = REQUIREMENT_INSTRUCTIONS.format(
        lead_name=lead_name,
        rfp_section_text=rfp_section_text,
        matches_block=_matches_block(proposal_matches),
        exemplar_block=_exemplar_block(exemplar),
    )
    agent = Agent(model=OpenAIChat(id=VALIDATION_MODEL), output_schema=RequirementAssessment)
    result = agent.run(f"Requirement: {rfp_section_title}\n\n{prompt}").content
    return result


def assess_extra_section(section_title: str, section_text: str) -> str:
    prompt = (
        "This section of a proposal document doesn't appear to correspond to any "
        "specific ask in the RFP it responds to. Briefly assess whether it's valuable "
        "value-add (e.g. company background, differentiators) or unnecessary padding/"
        "filler that dilutes the proposal.\n\n"
        f"Section: {section_title}\n---\n{section_text}\n---"
    )
    agent = Agent(model=OpenAIChat(id=VALIDATION_MODEL), output_schema=ExtraSectionNote)
    result = agent.run(prompt).content
    return result.note


SYNTHESIS_INSTRUCTIONS = (
    'You are producing a final bid/no-bid recommendation for a proposal written for '
    'the prospective client "{lead_name}", based on a section-by-section review '
    "against its RFP.\n\n"
    "Per-requirement assessments:\n{requirement_summary}\n\n"
    "Sections in the proposal not requested by the RFP:\n{extra_summary}\n\n"
    "{other_sections_block}"
    "Produce: overall_score (0-100, weighing how fully and credibly the requirements "
    "are covered), recommendation ('bid' if the proposal is strong and requirements are "
    "well covered, 'no_bid' if coverage is poor or claims are unrealistic, 'conditional' "
    "if it's borderline and specific fixes would resolve it), a short summary "
    "explaining the recommendation, and suggested_sections: additional sections worth "
    "adding to this proposal, drawn from what other leads' proposals commonly include "
    "but this one lacks (empty list if nothing stands out)."
)


def _format_requirement_summary(items: list[dict]) -> str:
    if not items:
        return "(none)"
    return "\n".join(
        f"- {i['title']}: {i['coverage_status']} (score {i['score']:.0f}) — {i['realism_notes']}"
        for i in items
    )


def _format_extra_summary(items: list[dict]) -> str:
    if not items:
        return "(none)"
    return "\n".join(f"- {i['title']}: {i['note']}" for i in items)


def _other_sections_block(other_lead_proposal_sections: list[dict]) -> str:
    if not other_lead_proposal_sections:
        return ""
    titles = "\n".join(
        f"- {s['section_title']} (from {s['lead_name']}'s proposal)"
        for s in other_lead_proposal_sections
    )
    return f"Sections found in other leads' proposals:\n{titles}\n\n"


def synthesize_assessment(
    lead_name: str,
    requirement_items: list[dict],
    extra_items: list[dict],
    other_lead_proposal_sections: list[dict],
) -> OverallAssessment:
    prompt = SYNTHESIS_INSTRUCTIONS.format(
        lead_name=lead_name,
        requirement_summary=_format_requirement_summary(requirement_items),
        extra_summary=_format_extra_summary(extra_items),
        other_sections_block=_other_sections_block(other_lead_proposal_sections),
    )
    agent = Agent(model=OpenAIChat(id=VALIDATION_MODEL), output_schema=OverallAssessment)
    result = agent.run(prompt).content
    return result
