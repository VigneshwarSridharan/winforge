import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-600"
        />
        <button
          type="submit"
          disabled={!enabled || isFetching}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
        >
          {isFetching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <ErrorBanner message={error instanceof ApiError ? error.message : "Search failed."} />}

      {data && (
        <div className="space-y-2">
          {data.results.length === 0 && <p className="text-sm text-zinc-500">No results.</p>}
          {data.results.map((hit) => (
            <div
              key={hit.id}
              className="rounded-xl border border-zinc-200 bg-white p-3 text-left text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{hit.text}</ReactMarkdown>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {Object.entries(hit.metadata).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    {k}: {String(v)}
                  </span>
                ))}
                {hit.distance !== null && (
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                    distance: {hit.distance.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
