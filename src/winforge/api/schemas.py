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
