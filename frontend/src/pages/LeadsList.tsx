import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { deleteLead, listLeads } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { NewLeadModal } from "../components/NewLeadModal";

export function LeadsList() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads, error, isLoading, refetch } = useQuery({
    queryKey: qk.leads,
    queryFn: listLeads,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.leads }),
  });

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete lead "${name}"? This removes all its documents and search data.`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            New Lead
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading leads…</p>}
      {error && (
        <ErrorBanner
          message={error instanceof ApiError ? error.message : "Failed to load leads."}
          onRetry={() => refetch()}
        />
      )}

      {leads && leads.length === 0 && (
        <p className="text-sm text-gray-500">No leads yet. Create one to get started.</p>
      )}

      {leads && leads.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Documents (RFP / Proposal / Additional)</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-2">
                    <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{lead.status}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {lead.document_counts.rfp} / {lead.document_counts.proposal} /{" "}
                    {lead.document_counts.additional}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{new Date(lead.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(lead.id, lead.name)}
                      disabled={deleteMutation.isPending}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NewLeadModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
