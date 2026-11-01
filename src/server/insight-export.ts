/**
 * Insight Export (spec Module 4). Pure: Document metadata plus its Highlights
 * (with Notes, in reading order) -> Markdown. Uses stored quotes only, never
 * the PDF. Deterministic: no timestamps, no randomness.
 */
import type { DocumentDto, HighlightDto } from "../shared/api-types.ts";
import { pageReference } from "../shared/page-reference.ts";

export type InsightExport = { fileName: string; markdown: string };

const CONTEXT_LINE = "These are a reader's Highlights and Notes from this document, in reading order.";
const NO_HIGHLIGHTS = "*No highlights yet.*";
const BLOCK_SEPARATOR = "\n\n---\n\n";

/** `highlights` must be in reading order (as `Highlights.list` returns them). */
export function insightExport(
  document: Pick<DocumentDto, "title" | "author">,
  highlights: HighlightDto[],
): InsightExport {
  const header = [`# ${document.title}`, ...(document.author ? [`Author: ${document.author}`] : []), CONTEXT_LINE];
  const body = highlights.length === 0 ? NO_HIGHLIGHTS : highlights.map(highlightBlock).join(BLOCK_SEPARATOR);
  return {
    fileName: `${slugify(document.title)}-insights.md`,
    markdown: `${[...header, body].join("\n\n")}\n`,
  };
}

function highlightBlock(h: HighlightDto): string {
  const parts = [`**${pageReference(h.start, h.end)}**`, `> ${h.quote}`];
  // Verbatim, except trailing whitespace, so the output ends with exactly one newline.
  if (h.note) parts.push(`**Note:** ${h.note.text.trimEnd()}`);
  return parts.join("\n\n");
}

/** ASCII, lowercase, hyphen-separated; "document" if nothing usable remains. */
function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}
