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
