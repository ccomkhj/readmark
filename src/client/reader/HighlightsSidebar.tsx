import { useEffect, useRef } from "react";
import type { HighlightDto } from "../../shared/api-types.ts";
import { pageReference } from "../../shared/page-reference.ts";
import { highlightIdAt } from "./highlight-overlays.ts";
import { NoteEditor, type NoteActions } from "./NoteEditor.tsx";
import type { PdfViewer } from "./pdf-viewer.ts";

/** Space left above a Highlight scrolled to, so its context is visible. */
const SCROLL_MARGIN_PX = 96;

/**
 * The open Document's Highlights in reading order: page reference, quote and
 * Note. The active Highlight's entry expands in place into its Note editor.
 *
 * - Clicking an entry scrolls the Reader to its Highlight and makes it active;
 *   once there, `onJumped` lets the Reader emphasize it.
 * - A plain click on a Highlight in the pages (not the end of a text
 *   selection) makes it active and scrolls its entry into view; a click
 *   elsewhere in the pages closes the editor.
 *
 * Reads `highlights` from the Reader's single Highlight state (useHighlights),
 * so it follows creates, deletes and Note changes. Active-Highlight state is
 * owned by the caller so the overlays can mark it.
 */
export function HighlightsSidebar({
  viewer,
  highlights,
  activeId,
  onActiveChange,
  onJumped,
  actions,
}: {
  viewer: PdfViewer;
  /** In reading order (useHighlights' contract); null while loading. */
  highlights: readonly HighlightDto[] | null;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onJumped: (id: string) => void;
  actions: NoteActions;
}) {
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const scroller = viewer.scrollContainer;
    const onClick = (e: Event) => {
      const { clientX, clientY } = e as MouseEvent;
      if (!window.getSelection()?.isCollapsed) return;
      onActiveChange(highlightIdAt(viewer, clientX, clientY));
    };
    scroller.addEventListener("click", onClick);
    return () => scroller.removeEventListener("click", onClick);
  }, [viewer, onActiveChange]);

  // Keep the open editor in view (e.g. after clicking its Highlight in the pages).
  useEffect(() => {
    // Braces: scrollIntoView returns a Promise in newer browsers, not a cleanup.
    void activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // Only the latest click scrolls, even if an earlier one's page renders later.
  const latestClick = useRef(0);
  const select = (highlight: HighlightDto) => {
    const click = ++latestClick.current;
    onActiveChange(highlight.id);
    void scrollToHighlight(viewer, highlight, () => click === latestClick.current).then(
      (arrived) => arrived && onJumped(highlight.id),
    );
  };

  return (
    <aside className="highlights-sidebar" aria-label="Highlights">
      <h2>Highlights</h2>
      {highlights?.length === 0 && (
        <p className="highlights-empty">No Highlights yet. Select text on a page and press H to highlight it.</p>
      )}
      {highlights && highlights.length > 0 && (
        <ol className="highlights-list">
          {highlights.map((h) =>
            h.id === activeId ? (
              <li key={h.id} ref={activeRef} className="highlights-active">
                <NoteEditor key={h.id} highlight={h} actions={actions} onClose={() => onActiveChange(null)} />
              </li>
            ) : (
              <li key={h.id}>
                <button type="button" className="highlights-entry" data-highlight-id={h.id} onClick={() => select(h)}>
                  <span className="highlights-page">{pageReference(h.start, h.end)}</span>
                  <span className="highlights-quote">{h.quote}</span>
                  {h.note && <span className="highlights-note">{h.note.text}</span>}
                </button>
              </li>
            ),
          )}
        </ol>
      )}
    </aside>
  );
}

/**
 * Scroll so the Highlight's first line sits near the top of the viewport.
 * Jumps to its start page first (pages render lazily), then refines using the
 * text item containing the start anchor. `stillWanted` aborts the refine.
 * Resolves true once scrolled there, false if aborted.
 */
async function scrollToHighlight(
  viewer: PdfViewer,
  highlight: HighlightDto,
  stillWanted: () => boolean,
): Promise<boolean> {
  const { page: pageNumber, offset } = highlight.start;
  viewer.scrollToPage(pageNumber);
  const page = await viewer.whenRendered(pageNumber);
  if (!stillWanted()) return false;
  // Last attached item starting at or before the anchor (empty items aren't in the DOM).
  const item = page.items.findLast((i) => i.start <= offset && i.element.isConnected);
  if (item) {
    const top = item.element.getBoundingClientRect().top - page.element.getBoundingClientRect().top;
    viewer.scrollToPage(pageNumber, Math.max(0, top - SCROLL_MARGIN_PX));
  }
  return true;
}
