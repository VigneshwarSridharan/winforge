import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProposal, proposalExportUrl } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError, type ProposalOut, type ProposalSectionStatus } from "../api/types";
import { ErrorBanner } from "./ErrorBanner";

const SECTION_STYLES: Record<ProposalSectionStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  drafting: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
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
    return <p className="text-sm text-gray-400">Waiting for RFP to finish indexing…</p>;
  }
  if (isLoading) return <p className="text-sm text-gray-500">Loading proposal draft…</p>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <p className="text-sm text-gray-400">Draft generation hasn't started yet.</p>;
    }
    return <ErrorBanner message="Failed to load proposal draft." />;
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Status: {data.status}</p>
        <a
          href={proposalExportUrl(leadId)}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Download draft (.md)
        </a>
      </div>
      <ol className="space-y-2">
        {data.sections.map((s) => (
          <li key={s.id} className="rounded border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{s.section_title}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SECTION_STYLES[s.status]}`}
              >
                {s.status}
              </span>
            </div>
            {s.exemplar_lead_name && (
              <p className="mt-1 text-xs text-gray-500">
                Referenced exemplar from lead "{s.exemplar_lead_name}"
                {s.exemplar_distance !== null && ` (distance ${s.exemplar_distance.toFixed(4)})`}
              </p>
            )}
            {s.status === "completed" && s.draft_text && (
              <div className="prose prose-sm mt-2 max-w-none text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.draft_text}</ReactMarkdown>
              </div>
            )}
            {s.status === "failed" && s.error_message && (
              <p className="mt-2 text-xs text-red-600">{s.error_message}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
