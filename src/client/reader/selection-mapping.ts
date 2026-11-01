/**
 * Browser selection mapping: turns a DOM Range over the Reader's text layers
 * into a Highlight range `[start, end)` of anchors.
 *
 * Each text-layer element is one PDF.js text item with a known start offset
 * in the canonical page text (see `RenderedPage.items`). A boundary inside an
 * item maps to item start + offset within the item. A boundary outside any
 * item (on a `<br>`, `.endOfContent`, the text layer itself, the page gap...)
 * snaps to the nearest item boundary in the direction that shrinks the
 * selection: the start moves forward to the next item's start, the end moves
 * back to the previous item's end.
 */
import { compareAnchors, deriveQuote, type Anchor } from "../../shared/page-text.ts";
import type { PdfViewer, RenderedPage, TextItemElement } from "./pdf-viewer.ts";

export type MappedSelection = { start: Anchor; end: Anchor; quote: string };

type LocatedItem = { page: RenderedPage; item: TextItemElement };

/**
 * Map `range` to anchors using the viewer's currently rendered pages. Returns
 * null when the range covers no text: outside the text layers, collapsed, or
 * whitespace-only (its quote would be empty).
 */
export function mapSelection(viewer: PdfViewer, range: Range): MappedSelection | null {
  const pages: RenderedPage[] = [];
  for (let n = 1; n <= viewer.pageCount; n++) {
    const page = viewer.renderedPage(n);
    if (page) pages.push(page);
  }
  // Items in document order (= page order, then text-layer order). Empty-string
  // items have no element in the DOM and cannot hold a boundary.
  const ordered: LocatedItem[] = [];
  const byElement = new Map<Node, LocatedItem>();
  for (const page of pages) {
    for (const item of page.items) {
      if (!item.element.isConnected) continue;
      const located = { page, item };
      ordered.push(located);
      byElement.set(item.element, located);
    }
  }
  if (ordered.length === 0) return null;

  const start = mapBoundary(range.startContainer, range.startOffset, "forward", ordered, byElement);
  const end = mapBoundary(range.endContainer, range.endOffset, "backward", ordered, byElement);
  if (!start || !end || compareAnchors(start, end) >= 0) return null;

  const texts: string[] = [];
  for (const page of pages) texts[page.pageNumber - 1] = page.text;
  // Pages between start and end that are not rendered would make the quote
  // wrong; the selection cannot span them in practice (they have no DOM).
  for (let p = start.page; p <= end.page; p++) if (texts[p - 1] === undefined) return null;
  const quote = deriveQuote(texts, start, end);
  return quote === "" ? null : { start, end, quote };
}

function mapBoundary(
  container: Node,
  offset: number,
  direction: "forward" | "backward",
  ordered: LocatedItem[],
  byElement: Map<Node, LocatedItem>,
): Anchor | null {
  const inside = containingItem(container, byElement);
  if (inside) {
    const { page, item } = inside;
    let within: number;
    if (container.nodeType === Node.TEXT_NODE) within = offset;
    else if (container === item.element) within = offset === 0 ? 0 : item.str.length;
    else within = direction === "forward" ? 0 : item.str.length;
    return { page: page.pageNumber, offset: item.start + Math.min(within, item.str.length) };
  }

  const point = document.createRange();
  point.setStart(container, offset);
  if (direction === "forward") {
    // First item that starts at or after the point.
    const next = ordered[firstIndex(ordered, (el) => point.comparePoint(el, 0) >= 0)];
    return next ? { page: next.page.pageNumber, offset: next.item.start } : null;
  }
  // Last item that ends at or before the point.
  const prev = ordered[firstIndex(ordered, (el) => point.comparePoint(el, el.childNodes.length) > 0) - 1];
  return prev ? { page: prev.page.pageNumber, offset: prev.item.start + prev.item.str.length } : null;
}

function containingItem(node: Node, byElement: Map<Node, LocatedItem>): LocatedItem | undefined {
  for (let n: Node | null = node; n; n = n.parentNode) {
    const found = byElement.get(n);
    if (found) return found;
  }
  return undefined;
}

/** Index of the first item whose element satisfies the monotone `test` (ordered.length if none). */
function firstIndex(ordered: LocatedItem[], test: (el: HTMLElement) => boolean): number {
  let lo = 0;
  let hi = ordered.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (test(ordered[mid]!.item.element)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
