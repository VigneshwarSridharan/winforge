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

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
