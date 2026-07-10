import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addDocument, deleteLead, getLead } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError, type DocType, type DocumentOut, type LeadDetailOut } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { FileUploadForm } from "../components/FileUploadForm";
import { ProposalPanel } from "../components/ProposalPanel";
import { SearchPanel } from "../components/SearchPanel";
import { StatusBadge } from "../components/StatusBadge";
import { ValidationPanel } from "../components/ValidationPanel";

const DOC_SECTIONS: { type: DocType; title: string }[] = [
  { type: "rfp", title: "RFP" },
  { type: "proposal", title: "Proposals" },
  { type: "additional", title: "Additional documents" },
];

type ProposalTab = "draft" | "report";

const PROPOSAL_TABS: { key: ProposalTab; label: string }[] = [
  { key: "draft", label: "Draft Proposal" },
  { key: "report", label: "Proposal Report" },
];

function hasInFlightDocuments(lead: LeadDetailOut | undefined): boolean {
  return !!lead?.documents.some((d) => d.status === "pending" || d.status === "processing");
}

function DocumentRow({ doc }: { doc: DocumentOut }) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{doc.original_filename}</p>
          {doc.status === "failed" && doc.error_message && (
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{doc.error_message}</p>
          )}
          {doc.status === "indexed" && doc.chunk_count !== null && (
            <p className="mt-0.5 text-xs text-zinc-500">{doc.chunk_count} chunks</p>
          )}
        </div>
        <StatusBadge status={doc.status} />
      </div>
    </li>
  );
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leadId = id!;

  const { data: lead, error, isLoading, refetch } = useQuery({
    queryKey: qk.lead(leadId),
    queryFn: () => getLead(leadId),
    refetchInterval: (query) => (hasInFlightDocuments(query.state.data) ? 2000 : false),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.leads });
      navigate("/leads");
    },
  });

  function handleDelete() {
    if (!lead) return;
    if (window.confirm(`Delete lead "${lead.name}"? This removes all its documents and search data.`)) {
      deleteMutation.mutate();
    }
  }

  async function handleAddDocument(file: File, docType?: DocType) {
    await addDocument(leadId, docType as Extract<DocType, "proposal" | "additional">, file);
    queryClient.invalidateQueries({ queryKey: qk.lead(leadId) });
  }

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <p className="text-sm text-zinc-500">Loading lead…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <ErrorBanner
          message={error instanceof ApiError ? error.message : "Failed to load lead."}
          onRetry={() => refetch()}
        />
      </div>
    );
  }
  if (!lead) return null;

  const hasIndexedDocument = lead.documents.some((d) => d.status === "indexed");
  const indexedProposalDocs = lead.documents.filter((d) => d.doc_type === "proposal" && d.status === "indexed");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="text-sm text-zinc-500 mb-2">
          <Link to="/leads" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Leads
          </Link>{" "}
          / <span className="text-zinc-700 dark:text-zinc-300">{lead.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{lead.name}</h2>
            <p className="text-zinc-500 mt-1 text-sm">
              Status: {lead.status} · Created {new Date(lead.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Delete lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-1 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Documents</h3>
            <div className="space-y-5">
              {DOC_SECTIONS.map(({ type, title }) => {
                const docs = lead.documents.filter((d) => d.doc_type === type);
                return (
                  <div key={type}>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h4>
                    {docs.length === 0 ? (
                      <p className="text-sm text-zinc-400 dark:text-zinc-600">None yet</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {docs.map((doc) => (
                          <DocumentRow key={doc.id} doc={doc} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <FileUploadForm
                  submitLabel="Add document"
                  docTypeOptions={[
                    { value: "proposal", label: "Proposal" },
                    { value: "additional", label: "Additional" },
                  ]}
                  onUpload={handleAddDocument}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Search</h3>
            <SearchPanel leadId={leadId} enabled={hasIndexedDocument} />
          </div>
        </div>

        <div className="col-span-2">
          <ProposalTabs leadId={leadId} hasIndexedDocument={hasIndexedDocument} proposalDocs={indexedProposalDocs} />
        </div>
      </div>
    </div>
  );
}

function ProposalTabs({
  leadId,
  hasIndexedDocument,
  proposalDocs,
}: {
  leadId: string;
  hasIndexedDocument: boolean;
  proposalDocs: DocumentOut[];
}) {
  const [tab, setTab] = useState<ProposalTab>("draft");

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
      <div className="flex gap-1 mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        {PROPOSAL_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-orange-600/20"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "draft" && <ProposalPanel leadId={leadId} enabled={hasIndexedDocument} />}

      {tab === "report" &&
        (proposalDocs.length === 0 ? (
          <p className="text-sm text-zinc-500">No indexed proposal documents yet.</p>
        ) : (
          <div className="space-y-6">
            {proposalDocs.map((doc) => (
              <div key={doc.id}>
                {proposalDocs.length > 1 && (
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">
                    {doc.original_filename}
                  </h4>
                )}
                <ValidationPanel leadId={leadId} documentId={doc.id} />
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
