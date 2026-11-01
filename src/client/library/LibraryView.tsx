import { useEffect, useRef, useState } from "react";
import type { DocumentDto } from "../../shared/api-types.ts";
import { importDocument, listDocuments, removeDocument } from "../api.ts";

type Notice = { kind: "info" | "error"; text: string };

/** Library view: every imported Document, newest first, plus import via file picker or drag and drop. */
export function LibraryView() {
  const [documents, setDocuments] = useState<DocumentDto[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => setDocuments(await listDocuments());

  useEffect(() => {
    refresh().catch((e: Error) => setNotice({ kind: "error", text: e.message }));
  }, []);

  const importFile = async (file: File | undefined) => {
    if (!file || importing) return;
    setImporting(true);
    setNotice(null);
    try {
      const { document, created } = await importDocument(file);
      if (!created) setNotice({ kind: "info", text: `"${document.title}" is already in your Library.` });
      await refresh();
    } catch (e) {
      // Server rejection messages (not_a_pdf, encrypted_pdf, no_text_layer) are written for people.
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onRemove = async (doc: DocumentDto) => {
    const confirmed = window.confirm(
      `Remove "${doc.title}" from your Library?\n\nIts Highlights and Notes will be removed too. This cannot be undone.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await removeDocument(doc.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main
      className={dragging ? "library dragging" : "library"}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void importFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="library-header">
        <h1>Library</h1>
        <label className="button">
          {importing ? "Importing…" : "Import PDF"}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={importing}
            onChange={(e) => importFile(e.target.files?.[0])}
          />
        </label>
      </header>

      {notice && (
        <p className={`message ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {documents === null ? (
        <p className="message">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="message">Your Library is empty. Import a PDF, or drop one here, to start reading.</p>
      ) : (
        <ul className="document-list" aria-label="Documents">
          {documents.map((doc) => (
            <li key={doc.id} className="document-row">
              <div className="document-title">{doc.title}</div>
              <div className="document-meta">
                <span>{doc.author ?? "Unknown author"}</span>
                <span>{plural(doc.pageCount, "page")}</span>
                <span>{plural(doc.highlightCount, "highlight")}</span>
              </div>
              <button
                type="button"
                className="remove-button"
                aria-label={`Remove ${doc.title}`}
                onClick={() => onRemove(doc)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
