import type { DocType } from "./types";

export const qk = {
  leads: ["leads"] as const,
  lead: (id: string) => ["leads", id] as const,
  documents: (id: string, docType?: DocType) => ["leads", id, "documents", docType] as const,
  search: (id: string, q: string) => ["leads", id, "search", q] as const,
  proposal: (id: string) => ["leads", id, "proposal"] as const,
};
