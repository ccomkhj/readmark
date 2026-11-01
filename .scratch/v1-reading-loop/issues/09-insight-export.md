# 09: Insight Export

**What to build:** From the open Document I produce an Insight Export: a Markdown document I hand to an agent myself. I can download it as a file named after the Document, or copy it to my clipboard. It starts with the title, the author (if known), and one line telling the agent what it is reading. Then come my Highlights in reading order, each quoted exactly with its page number (or page range) and my Note beneath it. It is generated from saved data only, so it is instant and identical every time for the same Highlights and Notes.

See spec: User Stories 40–48; Modules 4 (Insight Export); Insight Export format; HTTP API contract for `GET /api/documents/:id/export`; Testing Decisions.

**Blocked by:** 04 (Reader view), 05 (Highlights & Notes API)

**Status:** ready-for-agent

- [ ] `GET /api/documents/:id/export` returns `200 text/markdown` with a `Content-Disposition` filename of the slugified title plus `-insights.md`; `404 document_not_found` for unknown Document
- [ ] Format: line 1 `# <title>`; `Author: <author>` line only when author is known; one fixed context line saying these are the reader's Highlights and Notes from that Document, in reading order
- [ ] One block per Highlight in reading order, blocks separated by a horizontal rule; each block has a bold page reference (`p. N`, or `pp. N–M` with an en dash when crossing pages), the stored quote as a single blockquote line, and, if a Note exists, a paragraph starting with a bold `Note:` label followed by the Note text verbatim (multi-line and Markdown preserved)
- [ ] Zero Highlights: blocks replaced by a single italic "No highlights yet." line
- [ ] Output ends with exactly one trailing newline; deterministic (no timestamps, no randomness); built from stored data only, never re-parses the PDF
- [ ] API tests with exact full-string assertions: (a) zero Highlights; (b) mixed Highlights with and without Notes, including a cross-page Highlight and a multi-line Note; (c) a Document with no author
- [ ] Reader offers Download (saves the Markdown under the endpoint's filename) and Copy (puts the Markdown on the clipboard, with confirmation)
- [ ] Verified with Chrome DevTools MCP: downloaded and copied Markdown are identical to the endpoint response
