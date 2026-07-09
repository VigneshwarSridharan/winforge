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
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
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
        className="text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {busy ? (busyLabel ?? "Uploading and indexing…") : submitLabel}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
