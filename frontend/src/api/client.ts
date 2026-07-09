// Requires the winforge FastAPI backend running separately (uv run winforge-api).
import {
  ApiError,
  type DocType,
  type DocumentOut,
  type LeadCreateOut,
  type LeadDetailOut,
  type LeadSummaryOut,
  type SearchResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // response body wasn't JSON; fall back to statusText
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createLead(name: string, file: File): Promise<LeadCreateOut> {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);
  return request<LeadCreateOut>("/leads", { method: "POST", body: form });
}

export function listLeads(): Promise<LeadSummaryOut[]> {
  return request<LeadSummaryOut[]>("/leads");
}

export function getLead(id: string): Promise<LeadDetailOut> {
  return request<LeadDetailOut>(`/leads/${id}`);
}

export function addDocument(
  leadId: string,
  docType: Extract<DocType, "proposal" | "additional">,
  file: File,
): Promise<DocumentOut> {
  const form = new FormData();
  form.append("doc_type", docType);
  form.append("file", file);
  return request<DocumentOut>(`/leads/${leadId}/documents`, { method: "POST", body: form });
}

export function listDocuments(leadId: string, docType?: DocType): Promise<DocumentOut[]> {
  const query = docType ? `?doc_type=${encodeURIComponent(docType)}` : "";
  return request<DocumentOut[]>(`/leads/${leadId}/documents${query}`);
}

export function deleteLead(id: string): Promise<void> {
  return request<void>(`/leads/${id}`, { method: "DELETE" });
}

export function searchLead(leadId: string, q: string, nResults = 5): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, n_results: String(nResults) });
  return request<SearchResponse>(`/leads/${leadId}/search?${params.toString()}`);
}
