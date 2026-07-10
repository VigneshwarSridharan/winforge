from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: str
    doc_type: str
    original_filename: str
    status: str
    chunk_count: int | None
    error_message: str | None
    created_at: str


class LeadCreateOut(BaseModel):
    id: str
    name: str
    status: str
    rfp: DocumentOut


class LeadSummaryOut(BaseModel):
    id: str
    name: str
    status: str
    created_at: str
    document_counts: dict[str, int]


class LeadDetailOut(BaseModel):
    id: str
    name: str
    status: str
    created_at: str
    updated_at: str
    documents: list[DocumentOut]


class SearchHit(BaseModel):
    id: str
    text: str
    metadata: dict
    distance: float | None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchHit]


class ProposalSectionOut(BaseModel):
    id: str
    order_index: int
    section_title: str
    status: str
    draft_text: str | None
    exemplar_lead_id: str | None
    exemplar_lead_name: str | None
    exemplar_distance: float | None
    error_message: str | None


class ProposalOut(BaseModel):
    id: str
    lead_id: str
    status: str
    error_message: str | None
    created_at: str
    updated_at: str
    sections: list[ProposalSectionOut]


class ValidationItemOut(BaseModel):
    id: str
    order_index: int
    kind: str
    title: str
    source_text: str
    coverage_status: str | None
    score: float | None
    matched_text: str | None
    realism_notes: str | None
    suggestion: str | None
    exemplar_lead_id: str | None
    exemplar_lead_name: str | None
    exemplar_distance: float | None
    status: str
    error_message: str | None


class SuggestedSectionOut(BaseModel):
    id: str
    order_index: int
    title: str
    rationale: str | None


class ProposalValidationOut(BaseModel):
    id: str
    lead_id: str
    proposal_document_id: str
    rfp_document_id: str
    status: str
    overall_score: float | None
    recommendation: str | None
    summary: str | None
    error_message: str | None
    created_at: str
    updated_at: str
    items: list[ValidationItemOut]
    suggested_sections: list[SuggestedSectionOut]
