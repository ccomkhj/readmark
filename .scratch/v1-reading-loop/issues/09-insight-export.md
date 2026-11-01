# 09: Insight Export

**What to build:** From the open Document I produce an Insight Export: a Markdown document I hand to an agent myself. I can download it as a file named after the Document, or copy it to my clipboard. It starts with the title, the author (if known), and one line telling the agent what it is reading. Then come my Highlights in reading order, each quoted exactly with its page number (or page range) and my Note beneath it. It is generated from saved data only, so it is instant and identical every time for the same Highlights and Notes.

See spec: User Stories 40–48; Modules 4 (Insight Export); Insight Export format; HTTP API contract for `GET /api/documents/:id/export`; Testing Decisions.

**Blocked by:** 04 (Reader view), 05 (Highlights & Notes API)

**Status:** resolved

- [x] `GET /api/documents/:id/export` returns `200 text/markdown` with a `Content-Disposition` filename of the slugified title plus `-insights.md`; `404 document_not_found` for unknown Document
- [x] Format: line 1 `# <title>`; `Author: <author>` line only when author is known; one fixed context line saying these are the reader's Highlights and Notes from that Document, in reading order
- [x] One block per Highlight in reading order, blocks separated by a horizontal rule; each block has a bold page reference (`p. N`, or `pp. N–M` with an en dash when crossing pages), the stored quote as a single blockquote line, and, if a Note exists, a paragraph starting with a bold `Note:` label followed by the Note text verbatim (multi-line and Markdown preserved)
- [x] Zero Highlights: blocks replaced by a single italic "No highlights yet." line
- [x] Output ends with exactly one trailing newline; deterministic (no timestamps, no randomness); built from stored data only, never re-parses the PDF
- [x] API tests with exact full-string assertions: (a) zero Highlights; (b) mixed Highlights with and without Notes, including a cross-page Highlight and a multi-line Note; (c) a Document with no author
- [x] Reader offers Download (saves the Markdown under the endpoint's filename) and Copy (puts the Markdown on the clipboard, with confirmation)
- [x] Verified with Chrome DevTools MCP: downloaded and copied Markdown are identical to the endpoint response

**Resolution notes:** Context line is "These are a reader's Highlights and Notes from this document, in reading order." A Note's trailing whitespace is trimmed in the export (so the output ends with exactly one newline); otherwise verbatim. Slug: NFKD, ASCII lowercase, non-alphanumeric runs -> `-`, `document` if empty. Browser check used an isolated headless Chrome over CDP (same protocol as DevTools MCP; avoids touching the system clipboard): download, clipboard, and endpoint bytes identical (sha1 54da0b4).
