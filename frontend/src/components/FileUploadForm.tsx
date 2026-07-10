import { useState, type FormEvent } from "react";
import type { DocType } from "../api/types";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

interface Props {
  submitLabel: string;
  busyLabel?: string;
  docTypeOptions?: { value: DocType; label: string }[];
  onUpload: (file: File, docType?: DocType) => Promise<unknown>;
}

export function FileUploadForm({ submitLabel, busyLabel, docTypeOptions, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType | undefined>(docTypeOptions?.[0]?.value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }
    if (!isPdf(file)) {
      setError("Only PDF files are supported.");
      return;
    }
    setBusy(true);
    try {
      await onUpload(file, docType);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      {docTypeOptions && (
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          disabled={busy}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
        >
          {docTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      <input
        type="file"
        accept="application/pdf"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-zinc-600 dark:text-zinc-400 file:mr-2 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-100 dark:file:border-zinc-700 dark:file:bg-zinc-800/50 dark:file:text-zinc-200 dark:hover:file:bg-zinc-800"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
      >
        {busy ? (busyLabel ?? "Uploading and indexing…") : submitLabel}
      </button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}
