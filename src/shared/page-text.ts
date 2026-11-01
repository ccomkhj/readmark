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

/**
 * Quote derivation: the text of `[start, end)` across canonical page texts
 * (index 0 = page 1), page segments joined with "\n", every whitespace run
 * collapsed to one space, trimmed. Anchors must be in bounds and in reading order.
 */
export function deriveQuote(pages: readonly string[], start: Anchor, end: Anchor): string {
  const segments: string[] = [];
  for (let page = start.page; page <= end.page; page++) {
    const text = pages[page - 1] ?? "";
    const from = page === start.page ? start.offset : 0;
    const to = page === end.page ? end.offset : text.length;
    segments.push(text.slice(from, to));
  }
  return segments.join("\n").replace(/\s+/g, " ").trim();
}
