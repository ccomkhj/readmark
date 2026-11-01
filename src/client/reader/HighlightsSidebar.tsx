import { useRef } from "react";
import type { HighlightDto } from "../../shared/api-types.ts";
import { pageReference } from "../../shared/page-reference.ts";
import type { PdfViewer } from "./pdf-viewer.ts";

/** Space left above a Highlight scrolled to, so its context is visible. */
const SCROLL_MARGIN_PX = 96;

/**
 * The open Document's Highlights in reading order: page reference, quote and
 * Note. Clicking an entry scrolls the Reader to it. Reads `highlights` from
 * the Reader's single Highlight state (useHighlights), so it follows creates,
 * deletes and Note changes without state of its own.
 */
export function HighlightsSidebar({
  viewer,
  highlights,
}: {
  viewer: PdfViewer;
  /** In reading order (useHighlights' contract); null while loading. */
  highlights: readonly HighlightDto[] | null;
}) {
  // Only the latest click scrolls, even if an earlier one's page renders later.
  const latestClick = useRef(0);
  const select = (highlight: HighlightDto) => {
    const click = ++latestClick.current;
    void scrollToHighlight(viewer, highlight, () => click === latestClick.current);
  };

  return (
    <aside className="highlights-sidebar" aria-label="Highlights">
      <h2>Highlights</h2>
      {highlights?.length === 0 && (
        <p className="highlights-empty">No Highlights yet. Select text on a page and press H to highlight it.</p>
      )}
      {highlights && highlights.length > 0 && (
        <ol className="highlights-list">
          {highlights.map((h) => (
            <li key={h.id}>
              <button type="button" className="highlights-entry" data-highlight-id={h.id} onClick={() => select(h)}>
                <span className="highlights-page">{pageReference(h.start, h.end)}</span>
                <span className="highlights-quote">{h.quote}</span>
                {h.note && <span className="highlights-note">{h.note.text}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/**
 * Scroll so the Highlight's first line sits near the top of the viewport.
 * Jumps to its start page first (pages render lazily), then refines using the
 * text item containing the start anchor. `stillWanted` aborts the refine.
 */
async function scrollToHighlight(viewer: PdfViewer, highlight: HighlightDto, stillWanted: () => boolean) {
  const { page: pageNumber, offset } = highlight.start;
  viewer.scrollToPage(pageNumber);
  const page = await viewer.whenRendered(pageNumber);
  if (!stillWanted()) return;
  // Last attached item starting at or before the anchor (empty items aren't in the DOM).
  const item = page.items.findLast((i) => i.start <= offset && i.element.isConnected);
  if (!item) return;
  const top = item.element.getBoundingClientRect().top - page.element.getBoundingClientRect().top;
  viewer.scrollToPage(pageNumber, Math.max(0, top - SCROLL_MARGIN_PX));
}
