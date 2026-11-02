import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Anchor, DocumentDto } from "../../shared/api-types.ts";
import { ApiError, documentFileUrl, getDocument } from "../api.ts";
import { clearRouteNotice, routeHref, routeNotice } from "../routes.ts";
import { ExportActions } from "./ExportActions.tsx";
import { drawHighlightOverlays } from "./highlight-overlays.ts";
import { HighlightsSidebar } from "./HighlightsSidebar.tsx";
import { PdfViewer } from "./pdf-viewer.ts";
import { ReaderToast, type ReaderMessage } from "./ReaderToast.tsx";
import { SelectionHighlighter } from "./SelectionHighlighter.tsx";
import { useHighlights } from "./use-highlights.ts";
import { useReadingPosition } from "./use-reading-position.ts";

/** Zoom levels the zoom buttons step through. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const DEFAULT_SCALE = 1.25;
/** How long a Highlight jumped to from the sidebar stays emphasized. */
const FLASH_MS = 1000;

/**
 * Reader view: one Document's pages in a continuous scroll (PdfViewer), with
 * a toolbar for page navigation and zoom. Opens at the Document's Reading
 * Position and keeps it saved (useReadingPosition).
 *
 * Layout: `.reader-toolbar` (back, title, page nav, zoom; feature actions go
 * at its end) above `.reader-body`, a row holding the `.reader-scroll`
 * page area and the Highlights sidebar (which holds the Note editor). Until the
 * first page renders, a loading state covers the page area; if the Document
 * can't be opened, an error state replaces it. Messages show in a toast over
 * the pages. Features that need the pages (selection mapping, Highlight
 * overlays, scroll-to) take `viewer`.
 */
export function ReaderView({ documentId }: { documentId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [viewer, setViewer] = useState<PdfViewer | null>(null);
  /** The Document couldn't be opened (metadata or PDF). */
  const [error, setError] = useState<string | null>(null);
  /** A page has rendered (or failed to): the loading state can go. */
  const [firstPageShown, setFirstPageShown] = useState(false);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const { highlights, loadError, create, ...highlightActions } = useHighlights(documentId);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  /** A Highlight jumped to from the sidebar, emphasized for FLASH_MS. A new object re-flashes the same id. */
  const [flash, setFlash] = useState<{ id: string } | null>(null);
  // Starts with e.g. "already in your Library" after a duplicate import (story 5).
  const [message, setMessage] = useState<ReaderMessage | null>(() => {
    const notice = routeNotice();
    return notice ? { kind: "info", text: notice } : null;
  });
  const dismissMessage = useCallback(() => setMessage(null), []);
  const onPositionSaveError = useCallback(
    (e: Error) => setMessage({ kind: "error", text: `Could not save your reading position: ${e.message}` }),
    [],
  );
  useReadingPosition(documentId, viewer, onPositionSaveError);

  useEffect(clearRouteNotice, []);

  useEffect(() => {
    if (loadError) setMessage({ kind: "error", text: `Could not load Highlights: ${loadError}` });
  }, [loadError]);

  useEffect(() => {
    let cancelled = false;
    let opened: PdfViewer | null = null;
    let resumePage: number | undefined;
    getDocument(documentId)
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
        resumePage = loaded.readingPosition?.page;
        return PdfViewer.open(scrollRef.current!, documentFileUrl(documentId), { scale: DEFAULT_SCALE });
      })
      .then((v) => {
        if (!v) return;
        if (cancelled) return v.destroy();
        opened = v;
        const shown = () => setFirstPageShown(true);
        v.on("pageRendered", shown);
        v.on("pageError", shown);
        v.on("pageChange", setPage);
        v.on("scaleChange", setScale);
        // Resume where the reader left off, before anything saves the position.
        if (resumePage !== undefined) v.scrollToPage(resumePage);
        setViewer(v);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [documentId]);

  useEffect(() => {
    if (doc) document.title = `${doc.title} · Readmark`;
    return () => {
      document.title = "Readmark";
    };
  }, [doc]);

  useEffect(() => {
    if (viewer && highlights) return drawHighlightOverlays(viewer, highlights, activeHighlightId, flash?.id);
  }, [viewer, highlights, activeHighlightId, flash]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const createHighlight = async (start: Anchor, end: Anchor) => {
    try {
      await create(start, end);
      setMessage(null);
    } catch (e) {
      // Whitespace-only selections offer no action, but stay silent on empty_highlight anyway (story 29).
      if (!(e instanceof ApiError && e.code === "empty_highlight")) {
        setMessage({ kind: "error", text: highlightErrorMessage(e) });
      }
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
            <PageNav viewer={viewer} page={page} onJumped={() => viewer.scrollContainer.focus({ preventScroll: true })} />
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

      <div className="reader-body">
        <div className="reader-pages">
          {/* Focusable so focus can leave the toolbar for the pages (keyboard scrolling, H shortcut). */}
          <div className="reader-scroll" ref={scrollRef} tabIndex={-1} />
          {error ? (
            <div className="reader-status error" role="alert">
              <p>Could not open this Document: {error}</p>
              <a href={routeHref({ view: "library" })}>Back to Library</a>
            </div>
          ) : (
            !firstPageShown && (
              <div className="reader-status" role="status">
                <p>{doc ? `Loading ${doc.title}…` : "Loading…"}</p>
              </div>
            )
          )}
          {/* No toast over the error state: it already says why (and Highlights would fail too). */}
          <ReaderToast message={error ? null : message} onDismiss={dismissMessage} />
        </div>
        {viewer && <SelectionHighlighter viewer={viewer} onCreate={createHighlight} />}
        {viewer && (
          <HighlightsSidebar
            viewer={viewer}
            highlights={highlights}
            activeId={activeHighlightId}
            onActiveChange={setActiveHighlightId}
            onJumped={(id) => setFlash({ id })}
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
 * non-numbers are rejected (the field resets to the current page). After a
 * jump, `onJumped` takes focus away from the field (so shortcuts work again).
 */
function PageNav({ viewer, page, onJumped }: { viewer: PdfViewer; page: number; onJumped: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const requested = Number.parseInt(draft ?? "", 10);
    setDraft(null);
    if (Number.isFinite(requested)) {
      viewer.scrollToPage(requested);
      onJumped();
    }
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
