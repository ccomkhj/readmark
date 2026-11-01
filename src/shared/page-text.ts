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
 * Canonical page text: item strings concatenated in order, with "\n" appended
 * after each item PDF.js marks as end-of-line.
 */
export function canonicalPageText(items: readonly PdfTextItem[]): string {
  let text = "";
  for (const item of items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  return text;
}
