import { useQuery } from "@tanstack/react-query";
import { getProposalValidation } from "../api/client";
import { qk } from "../api/queryKeys";
import {
  ApiError,
  type CoverageStatus,
  type ProposalValidationOut,
  type Recommendation,
  type ValidationItemStatus,
} from "../api/types";
import { DANGER_BADGE, INFO_BADGE, NEUTRAL_BADGE, SUCCESS_BADGE, WARNING_BADGE } from "../theme/badges";
import { ErrorBanner } from "./ErrorBanner";

const ITEM_STYLES: Record<ValidationItemStatus, string> = {
  pending: NEUTRAL_BADGE,
  evaluating: INFO_BADGE,
  completed: SUCCESS_BADGE,
  failed: DANGER_BADGE,
};

const COVERAGE_STYLES: Record<CoverageStatus, string> = {
  fulfilled: SUCCESS_BADGE,
  partial: WARNING_BADGE,
  missing: NEUTRAL_BADGE,
};

const COVERAGE_DOT: Record<CoverageStatus, string> = {
  fulfilled: "bg-emerald-500 dark:bg-emerald-400",
  partial: "bg-amber-500 dark:bg-amber-400",
  missing: "bg-zinc-400 dark:bg-zinc-600",
};

const RECOMMENDATION_STYLES: Record<Recommendation, string> = {
  bid: SUCCESS_BADGE,
  conditional: WARNING_BADGE,
  no_bid: DANGER_BADGE,
};

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  bid: "Bid",
  conditional: "Conditional",
  no_bid: "No bid",
};

function isInFlight(v: ProposalValidationOut | undefined): boolean {
  return v?.status === "pending" || v?.status === "validating";
}

export function ValidationPanel({ leadId, documentId }: { leadId: string; documentId: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: qk.proposalValidation(leadId, documentId),
    queryFn: () => getProposalValidation(leadId, documentId),
    retry: false,
    refetchInterval: (query) => (isInFlight(query.state.data) ? 2000 : false),
  });

  if (isLoading) return <p className="mt-2 text-xs text-zinc-500">Validating against RFP…</p>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-600">Validation hasn't started yet.</p>;
    }
    return <ErrorBanner message="Failed to load validation results." />;
  }
  if (!data) return null;

  const requirements = data.items.filter((i) => i.kind === "requirement");
  const extras = data.items.filter((i) => i.kind === "extra_section");

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Proposal validation: {data.status}</p>
        {data.recommendation && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RECOMMENDATION_STYLES[data.recommendation]}`}
          >
            {RECOMMENDATION_LABELS[data.recommendation]}
            {data.overall_score !== null && ` · ${data.overall_score.toFixed(0)}/100`}
          </span>
        )}
      </div>

      {data.summary && <p className="text-xs text-zinc-600 dark:text-zinc-400">{data.summary}</p>}
      {data.status === "failed" && data.error_message && (
        <p className="text-xs text-red-600 dark:text-red-400">{data.error_message}</p>
      )}

      {requirements.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">RFP requirements</h4>
          <ol className="space-y-2">
            {requirements.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.coverage_status && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${COVERAGE_DOT[item.coverage_status]}`} />
                    )}
                    <h5 className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.title}</h5>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.coverage_status && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COVERAGE_STYLES[item.coverage_status]}`}>
                        {item.coverage_status}
                        {item.score !== null && ` · ${item.score.toFixed(0)}`}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ITEM_STYLES[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                {item.realism_notes && (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.realism_notes}</p>
                )}
                {item.suggestion && (
                  <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">Suggestion: {item.suggestion}</p>
                )}
                {item.exemplar_lead_name && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Referenced exemplar from lead "{item.exemplar_lead_name}"
                    {item.exemplar_distance !== null && ` (distance ${item.exemplar_distance.toFixed(4)})`}
                  </p>
                )}
                {item.status === "failed" && item.error_message && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error_message}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {extras.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Extra sections (not requested by the RFP)
          </h4>
          <ul className="space-y-1">
            {extras.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{item.title}</p>
                {item.realism_notes && (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.realism_notes}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.suggested_sections.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Suggested additional sections
          </h4>
          <ul className="space-y-1">
            {data.suggested_sections.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{s.title}</p>
                {s.rationale && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{s.rationale}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
