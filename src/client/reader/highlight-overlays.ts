/**
 * Highlight overlays: draws each Highlight as rectangles over its text, in a
 * `.highlight-layer` inside each rendered page (between the canvas and the
 * text layer, so selection still works over highlighted text).
 *
 * Pages are released and re-rendered (new DOM) on scroll and on every zoom,
 * so a page's overlays are redrawn on every `pageRendered`; nothing here keeps
 * DOM references across renders. Rect positions are CSS px relative to the
 * `.pdf-page`, measured from the text-layer spans, so they follow the zoom.
 */
import type { HighlightDto } from "../../shared/api-types.ts";
import type { PdfViewer, RenderedPage } from "./pdf-viewer.ts";

const LAYER_CLASS = "highlight-layer";
const RECT_CLASS = "highlight-rect";
/** On rects of a Highlight that has a Note (styled differently, spec story 37). */
const HAS_NOTE_CLASS = "has-note";
/** On rects of the Highlight open in the Note editor. */
const ACTIVE_CLASS = "active";
/** On rects of a Highlight just jumped to, so the eye finds it (a short CSS animation). */
const FLASH_CLASS = "flash";

/**
 * Keep overlays in sync with `highlights` on every rendered page, now and on
 * each future page render. Returns a cleanup that stops listening; call it and
 * call again whenever `highlights`, `activeId` or `flashId` changes. Highlights
 * with a Note, the active one (open in the Note editor) and the flashed one
 * get marker classes.
 */
export function drawHighlightOverlays(
  viewer: PdfViewer,
  highlights: readonly HighlightDto[],
  activeId: string | null = null,
  flashId: string | null = null,
): () => void {
  const marks = { activeId, flashId };
  for (let n = 1; n <= viewer.pageCount; n++) {
    const page = viewer.renderedPage(n);
    if (page) drawPage(page, highlights, marks);
  }
  return viewer.on("pageRendered", (page) => drawPage(page, highlights, marks));
}

/**
 * The id of the Highlight drawn at a viewport point, or null. Overlays don't
 * take pointer events (the text layer above them must stay selectable), so
 * clicks are hit-tested geometrically.
 */
export function highlightIdAt(viewer: PdfViewer, clientX: number, clientY: number): string | null {
  for (let n = 1; n <= viewer.pageCount; n++) {
    if (!viewer.renderedPage(n)) continue;
    for (const rect of viewer.pageElement(n).querySelectorAll<HTMLElement>(`.${RECT_CLASS}`)) {
      const r = rect.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return rect.dataset.highlightId ?? null;
      }
    }
  }
  return null;
}

function drawPage(
  page: RenderedPage,
  highlights: readonly HighlightDto[],
  { activeId, flashId }: { activeId: string | null; flashId: string | null },
): void {
  let layer = page.element.querySelector<HTMLElement>(`:scope > .${LAYER_CLASS}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = LAYER_CLASS;
    page.element.insertBefore(layer, page.textLayer);
  }
  const origin = page.element.getBoundingClientRect();
  const rects: HTMLElement[] = [];
  // Draw a Highlight's body segments, not its whole range, so page furniture
  // (running headers, footers) inside a cross-page Highlight stays unmarked.
  // Each segment lies on one page.
  for (const highlight of highlights) {
    for (const { start, end } of highlight.segments) {
      if (start.page !== page.pageNumber) continue;
      for (const item of page.items) {
        const textNode = item.element.firstChild;
        if (!item.element.isConnected || !textNode) continue;
        const a = Math.max(start.offset, item.start) - item.start;
        const b = Math.min(end.offset, item.start + item.str.length) - item.start;
        if (a >= b) continue;
        const range = document.createRange();
        range.setStart(textNode, a);
        range.setEnd(textNode, b);
        const r = range.getBoundingClientRect();
        const el = document.createElement("div");
        el.className = RECT_CLASS;
        el.classList.toggle(HAS_NOTE_CLASS, highlight.note !== null);
        el.classList.toggle(ACTIVE_CLASS, highlight.id === activeId);
        el.classList.toggle(FLASH_CLASS, highlight.id === flashId);
        el.dataset.highlightId = highlight.id;
        el.style.left = `${r.left - origin.left}px`;
        el.style.top = `${r.top - origin.top}px`;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
        rects.push(el);
      }
    }
  }
  layer.replaceChildren(...rects);
}
