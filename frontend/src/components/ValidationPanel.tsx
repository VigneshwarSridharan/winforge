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
import { ErrorBanner } from "./ErrorBanner";

const ITEM_STYLES: Record<ValidationItemStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  evaluating: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const COVERAGE_STYLES: Record<CoverageStatus, string> = {
  fulfilled: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  missing: "bg-red-100 text-red-700",
};

const RECOMMENDATION_STYLES: Record<Recommendation, string> = {
  bid: "bg-green-100 text-green-700",
  conditional: "bg-yellow-100 text-yellow-700",
  no_bid: "bg-red-100 text-red-700",
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

  if (isLoading) return <p className="mt-2 text-xs text-gray-500">Validating against RFP…</p>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <p className="mt-2 text-xs text-gray-400">Validation hasn't started yet.</p>;
    }
    return <ErrorBanner message="Failed to load validation results." />;
  }
  if (!data) return null;

  const requirements = data.items.filter((i) => i.kind === "requirement");
  const extras = data.items.filter((i) => i.kind === "extra_section");

  return (
    <div className="mt-3 space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">Proposal validation: {data.status}</p>
        {data.recommendation && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RECOMMENDATION_STYLES[data.recommendation]}`}
          >
            {RECOMMENDATION_LABELS[data.recommendation]}
            {data.overall_score !== null && ` · ${data.overall_score.toFixed(0)}/100`}
          </span>
        )}
      </div>

      {data.summary && <p className="text-xs text-gray-700">{data.summary}</p>}
      {data.status === "failed" && data.error_message && (
        <p className="text-xs text-red-600">{data.error_message}</p>
      )}

      {requirements.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">RFP requirements</h4>
          <ol className="space-y-2">
            {requirements.map((item) => (
              <li key={item.id} className="rounded border border-gray-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-xs font-medium text-gray-900">{item.title}</h5>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.coverage_status && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${COVERAGE_STYLES[item.coverage_status]}`}
                      >
                        {item.coverage_status}
                        {item.score !== null && ` · ${item.score.toFixed(0)}`}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ITEM_STYLES[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
                {item.realism_notes && (
                  <p className="mt-1 text-xs text-gray-600">{item.realism_notes}</p>
                )}
                {item.suggestion && (
                  <p className="mt-1 text-xs text-blue-700">Suggestion: {item.suggestion}</p>
                )}
                {item.exemplar_lead_name && (
                  <p className="mt-1 text-xs text-gray-500">
                    Referenced exemplar from lead "{item.exemplar_lead_name}"
                    {item.exemplar_distance !== null &&
                      ` (distance ${item.exemplar_distance.toFixed(4)})`}
                  </p>
                )}
                {item.status === "failed" && item.error_message && (
                  <p className="mt-1 text-xs text-red-600">{item.error_message}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {extras.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
            Extra sections (not requested by the RFP)
          </h4>
          <ul className="space-y-1">
            {extras.map((item) => (
              <li key={item.id} className="rounded border border-gray-200 bg-white p-2">
                <p className="text-xs font-medium text-gray-900">{item.title}</p>
                {item.realism_notes && (
                  <p className="mt-1 text-xs text-gray-600">{item.realism_notes}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.suggested_sections.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
            Suggested additional sections
          </h4>
          <ul className="space-y-1">
            {data.suggested_sections.map((s) => (
              <li key={s.id} className="rounded border border-gray-200 bg-white p-2">
                <p className="text-xs font-medium text-gray-900">{s.title}</p>
                {s.rationale && <p className="mt-1 text-xs text-gray-600">{s.rationale}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
