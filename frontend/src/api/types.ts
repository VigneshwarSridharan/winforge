export type DocType = "rfp" | "proposal" | "additional";
export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";
export type LeadStatus = "active" | "deleted";

export interface DocumentOut {
  id: string;
  doc_type: DocType;
  original_filename: string;
  status: DocumentStatus;
  chunk_count: number | null;
  error_message: string | null;
  created_at: string;
}

export interface LeadCreateOut {
  id: string;
  name: string;
  status: LeadStatus;
  rfp: DocumentOut;
}

export interface LeadSummaryOut {
  id: string;
  name: string;
  status: LeadStatus;
  created_at: string;
  document_counts: { rfp: number; proposal: number; additional: number };
}

export interface LeadDetailOut {
  id: string;
  name: string;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  documents: DocumentOut[];
}

export interface SearchHit {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
  distance: number | null;
}

export interface SearchResponse {
  query: string;
  results: SearchHit[];
}

export type ProposalStatus = "pending" | "generating" | "completed" | "failed";
export type ProposalSectionStatus = "pending" | "drafting" | "completed" | "failed";

export interface ProposalSectionOut {
  id: string;
  order_index: number;
  section_title: string;
  status: ProposalSectionStatus;
  draft_text: string | null;
  exemplar_lead_id: string | null;
  exemplar_lead_name: string | null;
  exemplar_distance: number | null;
  error_message: string | null;
}

export interface ProposalOut {
  id: string;
  lead_id: string;
  status: ProposalStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  sections: ProposalSectionOut[];
}

export type ValidationStatus = "pending" | "validating" | "completed" | "failed";
export type ValidationItemStatus = "pending" | "evaluating" | "completed" | "failed";
export type ValidationItemKind = "requirement" | "extra_section";
export type CoverageStatus = "fulfilled" | "partial" | "missing";
export type Recommendation = "bid" | "no_bid" | "conditional";

export interface ValidationItemOut {
  id: string;
  order_index: number;
  kind: ValidationItemKind;
  title: string;
  source_text: string;
  coverage_status: CoverageStatus | null;
  score: number | null;
  matched_text: string | null;
  realism_notes: string | null;
  suggestion: string | null;
  exemplar_lead_id: string | null;
  exemplar_lead_name: string | null;
  exemplar_distance: number | null;
  status: ValidationItemStatus;
  error_message: string | null;
}

export interface SuggestedSectionOut {
  id: string;
  order_index: number;
  title: string;
  rationale: string | null;
}

export interface ProposalValidationOut {
  id: string;
  lead_id: string;
  proposal_document_id: string;
  rfp_document_id: string;
  status: ValidationStatus;
  overall_score: number | null;
  recommendation: Recommendation | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  items: ValidationItemOut[];
  suggested_sections: SuggestedSectionOut[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
