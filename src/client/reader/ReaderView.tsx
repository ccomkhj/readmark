import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Anchor, DocumentDto } from "../../shared/api-types.ts";
import { ApiError, documentFileUrl, getDocument } from "../api.ts";
import { clearRouteNotice, routeHref, routeNotice } from "../routes.ts";
import { ExportActions } from "./ExportActions.tsx";
import { drawHighlightOverlays } from "./highlight-overlays.ts";
import { HighlightsSidebar } from "./HighlightsSidebar.tsx";
import { NoteEditor } from "./NoteEditor.tsx";
import { PdfViewer } from "./pdf-viewer.ts";
import { SelectionHighlighter } from "./SelectionHighlighter.tsx";
import { useHighlights } from "./use-highlights.ts";

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
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [viewer, setViewer] = useState<PdfViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const { highlights, loadError, create, ...highlightActions } = useHighlights(documentId);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  // e.g. "already in your Library" after a duplicate import (story 5).
  const [notice] = useState(routeNotice);

  useEffect(clearRouteNotice, []);

  useEffect(() => {
    let cancelled = false;
    let opened: PdfViewer | null = null;
    getDocument(documentId)
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
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
    if (doc) document.title = `${doc.title} · Book Reader`;
    return () => {
      document.title = "Book Reader";
    };
  }, [doc]);

  useEffect(() => {
    if (viewer && highlights) return drawHighlightOverlays(viewer, highlights, activeHighlightId);
  }, [viewer, highlights, activeHighlightId]);

  const createHighlight = async (start: Anchor, end: Anchor) => {
    setHighlightError(null);
    try {
      await create(start, end);
    } catch (e) {
      // Whitespace-only selections offer no action, but stay silent on empty_highlight anyway (story 29).
      if (!(e instanceof ApiError && e.code === "empty_highlight")) setHighlightError(highlightErrorMessage(e));
      throw e;
    }
  };

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
        <h1 className="reader-title" title={doc?.title}>
          {doc?.title ?? (error ? "" : "Loading…")}
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
        {doc && <ExportActions documentId={documentId} />}
      </header>

      {notice && (
        <p className="message info reader-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="message error reader-message" role="alert">
          {error}
        </p>
      )}
      {(highlightError ?? loadError) && (
        <p className="message error reader-message" role="alert">
          {highlightError ?? `Could not load Highlights: ${loadError}`}
        </p>
      )}

      <div className="reader-body">
        <div className="reader-scroll" ref={scrollRef} />
        {viewer && <SelectionHighlighter viewer={viewer} onCreate={createHighlight} />}
        {viewer && <HighlightsSidebar viewer={viewer} highlights={highlights} />}
        {viewer && highlights && (
          <NoteEditor
            viewer={viewer}
            highlights={highlights}
            activeId={activeHighlightId}
            onActiveChange={setActiveHighlightId}
            actions={highlightActions}
          />
        )}
      </div>
    </div>
  );
}

function highlightErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === "overlapping_highlight") {
    return "This overlaps an existing Highlight. Highlights can't overlap.";
  }
  return `Could not create the Highlight: ${(e as Error).message}`;
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
