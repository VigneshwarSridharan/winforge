import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { deleteLead, listLeads } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError, type LeadStatus } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { NewLeadModal } from "../components/NewLeadModal";

const STATUS_STYLES: Record<LeadStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  deleted: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  active: "bg-emerald-500 dark:bg-emerald-400 animate-pulse",
  deleted: "bg-zinc-400 dark:bg-zinc-500",
};

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Leads</h2>
          <p className="text-zinc-500 mt-1 text-sm">Manage your RFPs and generated proposals</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors text-sm font-medium flex items-center gap-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 text-white transition-all text-sm font-semibold flex items-center gap-2 shadow-lg shadow-orange-600/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Lead
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-zinc-500">Loading leads…</p>}
      {error && (
        <ErrorBanner
          message={error instanceof ApiError ? error.message : "Failed to load leads."}
          onRetry={() => refetch()}
        />
      )}

      {leads && leads.length === 0 && (
        <p className="text-sm text-zinc-500">No leads yet. Create one to get started.</p>
      )}

      {leads && leads.length > 0 && (
        <>
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Documents (RFP / Proposal / Additional)</div>
            <div className="col-span-2">Created</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-colors rounded-lg group"
              >
                <div className="col-span-4 font-medium text-zinc-900 dark:text-zinc-100">
                  <Link to={`/leads/${lead.id}`} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                    {lead.name}
                  </Link>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[lead.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
                    {lead.status}
                  </span>
                </div>
                <div className="col-span-3 flex gap-2">
                  <span className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-mono border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                    {lead.document_counts.rfp}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-mono border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                    {lead.document_counts.proposal}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-mono border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                    {lead.document_counts.additional}
                  </span>
                </div>
                <div className="col-span-2 text-zinc-500 dark:text-zinc-400 text-sm font-mono">
                  {new Date(lead.created_at).toLocaleString()}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => handleDelete(lead.id, lead.name)}
                    disabled={deleteMutation.isPending}
                    className="text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && <NewLeadModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
