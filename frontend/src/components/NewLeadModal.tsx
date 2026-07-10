import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createLead } from "../api/client";
import { qk } from "../api/queryKeys";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function NewLeadModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => createLead(name, file!),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: qk.leads });
      onClose();
      navigate(`/leads/${lead.id}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create lead."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!file) {
      setError("Choose the RFP PDF.");
      return;
    }
    if (!isPdf(file)) {
      setError("Only PDF files are supported.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity dark:bg-black/60">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-md p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Lead</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Lead Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mutation.isPending}
              placeholder="e.g. Beta Power"
              autoFocus
              className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors disabled:opacity-50 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              RFP Document (PDF)
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer bg-zinc-50 hover:bg-zinc-100 hover:border-orange-500 transition-colors group dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-8 h-8 mb-3 text-zinc-400 group-hover:text-orange-500 transition-colors dark:text-zinc-500 dark:group-hover:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                {file ? (
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Click to upload</span> or drag
                    and drop
                  </p>
                )}
              </div>
              <input
                type="file"
                accept="application/pdf"
                disabled={mutation.isPending}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {mutation.isPending && (
            <p className="text-sm text-zinc-500">Uploading and indexing… this can take up to a minute.</p>
          )}

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors text-sm font-medium disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 text-white transition-all text-sm font-semibold shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              {mutation.isPending ? "Creating…" : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
