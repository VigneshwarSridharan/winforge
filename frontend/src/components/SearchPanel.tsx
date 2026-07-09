import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchLead } from "../api/client";
import { qk } from "../api/queryKeys";
import { ApiError } from "../api/types";
import { ErrorBanner } from "./ErrorBanner";

export function SearchPanel({ leadId, enabled }: { leadId: string; enabled: boolean }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: qk.search(leadId, submittedQuery ?? ""),
    queryFn: () => searchLead(leadId, submittedQuery ?? ""),
    enabled: enabled && !!submittedQuery,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (query === submittedQuery) {
      refetch();
    } else {
      setSubmittedQuery(query);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!enabled}
          placeholder={enabled ? "Search this lead's documents…" : "Index a document to enable search"}
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={!enabled || isFetching}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isFetching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <ErrorBanner message={error instanceof ApiError ? error.message : "Search failed."} />}

      {data && (
        <div className="space-y-2">
          {data.results.length === 0 && <p className="text-sm text-gray-500">No results.</p>}
          {data.results.map((hit) => (
            <div key={hit.id} className="rounded border border-gray-200 p-3 text-left text-sm">
              <p className="whitespace-pre-wrap text-gray-800">{hit.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {Object.entries(hit.metadata).map(([k, v]) => (
                  <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5">
                    {k}: {String(v)}
                  </span>
                ))}
                {hit.distance !== null && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5">distance: {hit.distance.toFixed(4)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
