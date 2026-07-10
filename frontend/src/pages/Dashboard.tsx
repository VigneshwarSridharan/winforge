import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listLeads } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center gap-4 dark:bg-zinc-900/50 dark:border-zinc-800">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-600 shrink-0 dark:bg-orange-500/10 dark:text-orange-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: leads, error, isLoading, refetch } = useQuery({
    queryKey: qk.leads,
    queryFn: listLeads,
  });

  const totalLeads = leads?.length ?? 0;
  const activeLeads = leads?.filter((l) => l.status === "active").length ?? 0;
  const totalDocuments =
    leads?.reduce(
      (sum, l) => sum + l.document_counts.rfp + l.document_counts.proposal + l.document_counts.additional,
      0,
    ) ?? 0;
  const totalProposals = leads?.reduce((sum, l) => sum + l.document_counts.proposal, 0) ?? 0;

  const recentLeads = leads
    ? [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Dashboard</h2>
        <p className="text-zinc-500 mt-1 text-sm">Overview of your leads and proposal activity</p>
      </div>

      {error && (
        <ErrorBanner
          message={error instanceof ApiError ? error.message : "Failed to load dashboard data."}
          onRetry={() => refetch()}
        />
      )}

      {isLoading && <p className="text-sm text-zinc-500">Loading dashboard…</p>}

      {leads && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total leads"
              value={totalLeads}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              }
            />
            <StatCard
              label="Active leads"
              value={activeLeads}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <StatCard
              label="Documents indexed"
              value={totalDocuments}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Proposals uploaded"
              value={totalProposals}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 7h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"
                  />
                </svg>
              }
            />
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Recent leads</h3>
              <Link
                to="/leads"
                className="text-sm text-orange-600 hover:text-orange-500 font-medium dark:text-orange-400"
              >
                View all
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <p className="text-sm text-zinc-500">No leads yet. Create one to get started.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between py-3">
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-sm font-medium text-zinc-900 hover:text-orange-600 transition-colors dark:text-zinc-100 dark:hover:text-orange-400"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-xs text-zinc-500 font-mono">
                      {new Date(lead.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
