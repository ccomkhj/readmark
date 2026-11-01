import type { Anchor } from "./page-text.ts";

/**
 * A Highlight's page reference: `p. N` on one page, `pp. N–M` when it crosses
 * a page break. Shared by the Insight Export and the Reader's sidebar.
 */
export function pageReference(start: Anchor, end: Anchor): string {
  return start.page === end.page ? `p. ${start.page}` : `pp. ${start.page}–${end.page}`;
}
