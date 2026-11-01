/**
 * Page Text: the shared, pure core of anchoring. Browser and server must both
 * use this module so an anchor `{page, offset}` means the same thing on both
 * sides. Offsets are 0-based indexes into a page's canonical page text.
 */

/**
 * The parts of a PDF.js `getTextContent()` item this module reads. PDF.js also
 * yields marked-content entries (no `str`); those are skipped.
 */
export type PdfTextItem = { str: string; hasEOL: boolean } | { type: string };

/**
 * A page's canonical page text plus where each text item starts in it.
 * `itemStarts[i]` is the offset of the i-th text item (marked-content entries
 * skipped): the same indexing as PDF.js `TextLayer.textDivs`, so the browser
 * can map a text-layer element to an offset.
 */
export type PageTextLayout = { text: string; itemStarts: number[] };

/**
 * Lay out canonical page text: item strings concatenated in order, with "\n"
 * appended after each item PDF.js marks as end-of-line.
 */
export function layoutPageText(items: readonly PdfTextItem[]): PageTextLayout {
  let text = "";
  const itemStarts: number[] = [];
  for (const item of items) {
    if (!("str" in item)) continue;
    itemStarts.push(text.length);
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  return { text, itemStarts };
}

/** Canonical page text of a page's PDF.js text items. See `layoutPageText`. */
export function canonicalPageText(items: readonly PdfTextItem[]): string {
  return layoutPageText(items).text;
}

/**
 * A position in a Document: `page` is the 1-based physical page index,
 * `offset` a 0-based character offset into that page's canonical page text.
 * A range `[start, end)` excludes the character at `end`.
 */
export type Anchor = { page: number; offset: number };

/** Reading order: compares `(page, offset)` lexicographically. Negative if `a` comes first. */
export function compareAnchors(a: Anchor, b: Anchor): number {
  return a.page - b.page || a.offset - b.offset;
}

/**
 * True if `anchor` points into (or just past the end of) one of `pages`.
 * `pages` are canonical page texts, index 0 = page 1.
 */
export function isAnchorInBounds(pages: readonly string[], anchor: Anchor): boolean {
  const { page, offset } = anchor;
  if (!Number.isInteger(page) || !Number.isInteger(offset)) return false;
  const text = pages[page - 1];
  return text !== undefined && offset >= 0 && offset <= text.length;
}

/** A Highlight range `[start, end)` in reading order. */
export type TextRange = { start: Anchor; end: Anchor };

/** A `[start, end)` range of offsets within one page's canonical page text. */
export type PageSpan = { start: number; end: number };

/**
 * A Document's page furniture: per page (index 0 = page 1), the spans of its
 * furniture lines in page order, each without its line break.
 */
export type PageFurniture = readonly (readonly PageSpan[])[];

/** No page furniture: every character is body text. */
export const NO_FURNITURE: PageFurniture = [];

/** Documents shorter than this have no page furniture (nothing can recur). */
const FURNITURE_MIN_PAGES = 3;
/**
 * A pattern is furniture if it recurs at the same edge on at least this many
 * pages, and on at least `FURNITURE_MIN_SHARE` of all pages.
 */
const FURNITURE_MIN_RECURRENCE = 3;
const FURNITURE_MIN_SHARE = 1 / 4;
/** At most this many lines at each page edge can be furniture. */
const FURNITURE_EDGE_LINES = 3;

type Line = PageSpan & { text: string };
type Edge = "top" | "bottom";
const EDGES: readonly Edge[] = ["top", "bottom"];

/**
 * Page furniture detection: running headers, footers, watermarks and page
 * numbers, found as whole lines (EOL-delimited; blank lines ignored) at the
 * top or bottom edge of a page. Peeling inward from each edge, at most
 * `FURNITURE_EDGE_LINES` deep and stopping at the first body line, a line is
 * furniture if it has a letter or digit and, at that same edge on enough
 * pages (see `FURNITURE_MIN_RECURRENCE`):
 * - its shape recurs (numbers -> "#", whitespace collapsed): "Prepared
 *   exclusively for Zach", "Page # of #"; or
 * - it begins or ends with the page's printed page number, i.e. the physical
 *   page plus an offset that recurs: "GOOD-ENOUGH SOFTWARE 11" on page 36 and
 *   "16 CHAPTER 1 A PRAGMATIC PHILOSOPHY" on page 41 (offset -25). A bare
 *   page number ("25") may use an offset recurring at either edge, so the
 *   bottom number of a chapter-opening page counts too.
 * A Document of fewer than `FURNITURE_MIN_PAGES` pages has none. Pure and
 * deterministic: the same page texts always give the same furniture.
 */
export function detectPageFurniture(pages: readonly string[]): PageFurniture {
  if (pages.length < FURNITURE_MIN_PAGES) return NO_FURNITURE;
  const minPages = Math.max(FURNITURE_MIN_RECURRENCE, Math.ceil(pages.length * FURNITURE_MIN_SHARE));
  const edges = pages.map((text): Record<Edge, Line[]> => {
    const lines = pageLines(text);
    return { top: lines.slice(0, FURNITURE_EDGE_LINES), bottom: lines.slice(-FURNITURE_EDGE_LINES).reverse() };
  });

  // Per edge (and for offsets, either edge), the pages each shape /
  // page-number offset appears on (once per page).
  const shapePages: Record<Edge, Map<string, Set<number>>> = { top: new Map(), bottom: new Map() };
  const offsetPages: Record<Edge | "either", Map<number, Set<number>>> = {
    top: new Map(),
    bottom: new Map(),
    either: new Map(),
  };
  const add = <K>(map: Map<K, Set<number>>, key: K, page: number) => {
    map.set(key, (map.get(key) ?? new Set<number>()).add(page));
  };
  edges.forEach((edge, i) => {
    for (const side of EDGES) {
      for (const line of edge[side]) {
        if (!hasLetterOrDigit(line.text)) continue;
        add(shapePages[side], lineShape(line.text), i + 1);
        for (const n of edgeNumbers(line.text)) {
          add(offsetPages[side], n - (i + 1), i + 1);
          add(offsetPages.either, n - (i + 1), i + 1);
        }
      }
    }
  });
  const recurs = <K>(map: Map<K, Set<number>>, key: K) => (map.get(key)?.size ?? 0) >= minPages;

  return edges.map((edge, i) => {
    const page = i + 1;
    const isFurniture = (line: Line, side: Edge) => {
      if (!hasLetterOrDigit(line.text)) return false;
      if (recurs(shapePages[side], lineShape(line.text))) return true;
      const offsets = offsetPages[/^\s*\d+\s*$/.test(line.text) ? "either" : side];
      return edgeNumbers(line.text).some((n) => recurs(offsets, n - page));
    };
    const found = new Map<number, PageSpan>();
    for (const side of EDGES) {
      for (const line of edge[side]) {
        if (!isFurniture(line, side)) break;
        found.set(line.start, { start: line.start, end: line.end });
      }
    }
    return [...found.values()].sort((a, b) => a.start - b.start);
  });
}

/** Non-blank lines of a canonical page text, with their offsets. */
function pageLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const segment of text.split("\n")) {
    if (segment.trim() !== "") lines.push({ start, end: start + segment.length, text: segment });
    start += segment.length + 1;
  }
  return lines;
}

/** Lines without a letter or digit ("}", "* * *") are never furniture. */
function hasLetterOrDigit(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/** A line's shape: arabic and lowercase roman numbers as "#", whitespace collapsed. */
function lineShape(text: string): string {
  return text
    .replace(/\d+/g, "#")
    .replace(/\b[ivxlc]+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

/** The arabic numbers a line begins or ends with (a bare number counts once). */
function edgeNumbers(text: string): number[] {
  const t = text.trim();
  const first = /^(\d+)(?:\s|$)/.exec(t)?.[1];
  const last = /(?:^|\s)(\d+)$/.exec(t)?.[1];
  return [...new Set([first, last].filter((n) => n !== undefined).map(Number))];
}

/**
 * The parts of `[start, end)` that hold body text: the range split at page
 * breaks, minus `furniture`, each part trimmed of whitespace at both ends,
 * whitespace-only parts dropped. In reading order. Highlight overlays draw
 * these. Anchors must be in bounds and in reading order.
 */
export function bodySegments(
  pages: readonly string[],
  start: Anchor,
  end: Anchor,
  furniture: PageFurniture = NO_FURNITURE,
): TextRange[] {
  const segments: TextRange[] = [];
  const push = (page: number, text: string, from: number, to: number) => {
    while (from < to && /\s/.test(text[from]!)) from++;
    while (to > from && /\s/.test(text[to - 1]!)) to--;
    if (from < to) segments.push({ start: { page, offset: from }, end: { page, offset: to } });
  };
  for (let page = start.page; page <= end.page; page++) {
    const text = pages[page - 1] ?? "";
    let from = page === start.page ? start.offset : 0;
    const to = page === end.page ? end.offset : text.length;
    for (const span of furniture[page - 1] ?? []) {
      if (span.end <= from || span.start >= to) continue;
      push(page, text, from, span.start);
      from = span.end;
    }
    push(page, text, from, to);
  }
  return segments;
}

/**
 * Quote derivation: the texts of the body segments of `[start, end)` (see
 * `bodySegments`; page furniture excluded) joined with "\n", every whitespace
 * run collapsed to one space, trimmed. Anchors must be in bounds and in
 * reading order. Without `furniture` this is exactly the range's text, with
 * page segments joined by "\n" before collapsing.
 */
export function deriveQuote(
  pages: readonly string[],
  start: Anchor,
  end: Anchor,
  furniture: PageFurniture = NO_FURNITURE,
): string {
  return bodySegments(pages, start, end, furniture)
    .map(({ start: s, end: e }) => pages[s.page - 1]!.slice(s.offset, e.offset))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}
