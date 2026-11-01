import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DocumentDto } from "../../shared/api-types.ts";
import { documentFileUrl, getDocument } from "../api.ts";
import { routeHref } from "../routes.ts";
import { ExportActions } from "./ExportActions.tsx";
import { PdfViewer } from "./pdf-viewer.ts";

/** Zoom levels the zoom buttons step through. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const DEFAULT_SCALE = 1.25;

/**
 * Reader view: one Document's pages in a continuous scroll (PdfViewer), with
 * a toolbar for page navigation and zoom.
 *
 * Layout: `.reader-toolbar` (back, title, page nav, zoom; feature actions go
 * at its end) above `.reader-body`, a row holding the `.reader-scroll`
 * page area; a sidebar can sit beside it in that row. Features that need the
 * pages (selection mapping, Highlight overlays, scroll-to) take `viewer`.
 */
export function ReaderView({ documentId }: { documentId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [viewer, setViewer] = useState<PdfViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    let cancelled = false;
    let opened: PdfViewer | null = null;
    getDocument(documentId)
      .then((doc) => {
        if (cancelled) return;
        setDocument(doc);
        return PdfViewer.open(scrollRef.current!, documentFileUrl(documentId), { scale: DEFAULT_SCALE });
      })
      .then((v) => {
        if (!v) return;
        if (cancelled) return v.destroy();
        opened = v;
        v.on("pageChange", setPage);
        v.on("scaleChange", setScale);
        setViewer(v);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [documentId]);

  useEffect(() => {
    if (document) window.document.title = `${document.title} · Book Reader`;
    return () => {
      window.document.title = "Book Reader";
    };
  }, [document]);

  const zoom = (direction: 1 | -1) => {
    if (!viewer) return;
    const next =
      direction > 0
        ? ZOOM_STEPS.find((s) => s > viewer.scale + 1e-9)
        : ZOOM_STEPS.findLast((s) => s < viewer.scale - 1e-9);
    if (next !== undefined) viewer.setScale(next);
  };

  return (
    <div className="reader">
      <header className="reader-toolbar">
        <a className="reader-back" href={routeHref({ view: "library" })}>
          ← Library
        </a>
        <h1 className="reader-title" title={document?.title}>
          {document?.title ?? (error ? "" : "Loading…")}
        </h1>
        {viewer && (
          <>
            <PageNav viewer={viewer} page={page} />
            <div className="reader-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => zoom(-1)} disabled={scale <= ZOOM_STEPS[0]!} aria-label="Zoom out">
                −
              </button>
              <span className="reader-zoom-level" aria-live="polite">
                {Math.round(scale * 100)}%
              </span>
              <button type="button" onClick={() => zoom(1)} disabled={scale >= ZOOM_STEPS.at(-1)!} aria-label="Zoom in">
                +
              </button>
            </div>
          </>
        )}
        {document && <ExportActions documentId={documentId} />}
      </header>

      {error && (
        <p className="message error reader-message" role="alert">
          {error}
        </p>
      )}

      <div className="reader-body">
        <div className="reader-scroll" ref={scrollRef} />
      </div>
    </div>
  );
}

/**
 * Current page / total, editable to jump. Out-of-range numbers are clamped;
 * non-numbers are rejected (the field resets to the current page).
 */
function PageNav({ viewer, page }: { viewer: PdfViewer; page: number }) {
  const [draft, setDraft] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const requested = Number.parseInt(draft ?? "", 10);
    if (Number.isFinite(requested)) viewer.scrollToPage(requested);
    setDraft(null);
  };

  return (
    <form className="reader-page-nav" onSubmit={submit}>
      <input
        aria-label="Page number"
        inputMode="numeric"
        value={draft ?? String(page)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => setDraft(null)}
        size={Math.max(2, String(viewer.pageCount).length)}
      />
      <span>/ {viewer.pageCount}</span>
    </form>
  );
}
