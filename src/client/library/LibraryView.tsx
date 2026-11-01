import { useEffect, useRef, useState } from "react";
import type { DocumentDto } from "../../shared/api-types.ts";
import { importDocument, listDocuments } from "../api.ts";
import { routeHref } from "../routes.ts";

/** Library view: every imported Document, newest first, plus import via file picker. */
export function LibraryView() {
  const [documents, setDocuments] = useState<DocumentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => setDocuments(await listDocuments());

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      await importDocument(file);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <main className="library">
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
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </label>
      </header>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}

      {documents === null ? (
        <p className="message">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="message">Your Library is empty. Import a PDF to start reading.</p>
      ) : (
        <ul className="document-list" aria-label="Documents">
          {documents.map((doc) => (
            <li key={doc.id} className="document-row">
              <a className="document-title" href={routeHref({ view: "reader", documentId: doc.id })}>
                {doc.title}
              </a>
              <div className="document-meta">
                <span>{doc.author ?? "Unknown author"}</span>
                <span>{plural(doc.pageCount, "page")}</span>
                <span>{plural(doc.highlightCount, "highlight")}</span>
              </div>
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
