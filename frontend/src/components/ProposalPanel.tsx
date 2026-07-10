import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProposal, proposalExportUrl } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError, type ProposalOut, type ProposalSectionStatus } from "../api/types";
import { DANGER_BADGE, INFO_BADGE, NEUTRAL_BADGE, SUCCESS_BADGE } from "../theme/badges";

const SECTION_STYLES: Record<ProposalSectionStatus, string> = {
  pending: NEUTRAL_BADGE,
  drafting: INFO_BADGE,
  completed: SUCCESS_BADGE,
  failed: DANGER_BADGE,
};

function isInFlight(p: ProposalOut | undefined): boolean {
  return p?.status === "pending" || p?.status === "generating";
}

export function ProposalPanel({ leadId, enabled }: { leadId: string; enabled: boolean }) {
  const { data, error, isLoading } = useQuery({
    queryKey: qk.proposal(leadId),
    queryFn: () => getProposal(leadId),
    enabled,
    retry: false,
    refetchInterval: (query) => (isInFlight(query.state.data) ? 2000 : false),
  });

  if (!enabled) {
    return <p className="text-sm text-zinc-500">Waiting for RFP to finish indexing…</p>;
  }
  if (isLoading) return <p className="text-sm text-zinc-500">Loading proposal draft…</p>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <p className="text-sm text-zinc-500">Draft generation hasn't started yet.</p>;
    }
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 dark:bg-red-500/10 dark:border-red-500/20">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Failed to load proposal draft</h4>
            <p className="text-xs text-red-600/70 dark:text-red-300/70 mt-1">
              An error occurred while loading the document.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Status: {data.status}</p>
        <a
          href={proposalExportUrl(leadId)}
          className="rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 transition-all shadow-lg shadow-orange-600/20"
        >
          Download draft (.md)
        </a>
      </div>
      <ol className="space-y-2">
        {data.sections.map((s) => (
          <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.section_title}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SECTION_STYLES[s.status]}`}>
                {s.status}
              </span>
            </div>
            {s.exemplar_lead_name && (
              <p className="mt-1 text-xs text-zinc-500">
                Referenced exemplar from lead "{s.exemplar_lead_name}"
                {s.exemplar_distance !== null && ` (distance ${s.exemplar_distance.toFixed(4)})`}
              </p>
            )}
            {s.status === "completed" && s.draft_text && (
              <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-zinc-700 dark:text-zinc-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.draft_text}</ReactMarkdown>
              </div>
            )}
            {s.status === "failed" && s.error_message && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{s.error_message}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
