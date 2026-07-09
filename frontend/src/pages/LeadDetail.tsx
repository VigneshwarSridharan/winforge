import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addDocument, deleteLead, getLead } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError, type DocType, type DocumentOut, type LeadDetailOut } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { FileUploadForm } from "../components/FileUploadForm";
import { ProposalPanel } from "../components/ProposalPanel";
import { SearchPanel } from "../components/SearchPanel";
import { StatusBadge } from "../components/StatusBadge";

const DOC_SECTIONS: { type: DocType; title: string }[] = [
  { type: "rfp", title: "RFP" },
  { type: "proposal", title: "Proposals" },
  { type: "additional", title: "Additional documents" },
];

function hasInFlightDocuments(lead: LeadDetailOut | undefined): boolean {
  return !!lead?.documents.some((d) => d.status === "pending" || d.status === "processing");
}

function DocumentRow({ doc }: { doc: DocumentOut }) {
  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{doc.original_filename}</p>
        {doc.status === "failed" && doc.error_message && (
          <p className="mt-0.5 text-xs text-red-600">{doc.error_message}</p>
        )}
        {doc.status === "indexed" && doc.chunk_count !== null && (
          <p className="mt-0.5 text-xs text-gray-500">{doc.chunk_count} chunks</p>
        )}
      </div>
      <StatusBadge status={doc.status} />
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
      navigate("/");
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

  if (isLoading) return <p className="text-sm text-gray-500">Loading lead…</p>;
  if (error) {
    return (
      <ErrorBanner
        message={error instanceof ApiError ? error.message : "Failed to load lead."}
        onRetry={() => refetch()}
      />
    );
  }
  if (!lead) return null;

  const hasIndexedDocument = lead.documents.some((d) => d.status === "indexed");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-gray-500 hover:underline">
          ← Back to leads
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{lead.name}</h1>
          <p className="text-sm text-gray-500">
            Status: {lead.status} · Created {new Date(lead.created_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete lead
        </button>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
        {DOC_SECTIONS.map(({ type, title }) => {
          const docs = lead.documents.filter((d) => d.doc_type === type);
          return (
            <div key={type}>
              <h3 className="mb-1 text-xs font-medium uppercase text-gray-500">{title}</h3>
              {docs.length === 0 ? (
                <p className="text-sm text-gray-400">None yet</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        <div className="border-t border-gray-100 pt-3">
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

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Search</h2>
        <SearchPanel leadId={leadId} enabled={hasIndexedDocument} />
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Draft Proposal</h2>
        <ProposalPanel leadId={leadId} enabled={hasIndexedDocument} />
      </div>
    </div>
  );
}
