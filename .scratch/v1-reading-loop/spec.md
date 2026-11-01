# Spec: v1 reading loop (import → read → highlight → note → Insight Export)

Status: ready-for-agent

## Problem Statement

When I read PDFs (books, papers), the passages that matter and the thoughts they trigger end up scattered or lost. PDF readers let me mark text, but the marks stay locked inside the file or the reader app, mixed with the reader's own annotation format, and there is no clean way to hand "what I found important and what I thought about it" to an agent that can summarize or reason over it. I want a reading tool where marking a passage and attaching my thought is fast, and where the result comes out as a clean, faithful artifact an agent can consume.

## Solution

A personal, local-only web app. I import a PDF into my Library, read it in the browser, select one or more sentences and turn them into a Highlight, optionally attach a Note in my own words, and at any point produce an Insight Export: a Markdown document containing the Document's metadata and every Highlight in reading order, quoted exactly, with its page number and my Note beneath it. I hand that Markdown to an agent myself. The app never modifies my PDF, never talks to the network, and needs no account.

See `GLOSSARY.md` for terms and `docs/adr/0001-app-owned-annotations-content-identity.md` for the storage/identity decision.

## User Stories

### Library and import

1. As a reader, I want to import a PDF from my computer via a file picker, so that I can start reading it in the app.
2. As a reader, I want to drag and drop a PDF onto the Library view to import it, so that importing is fast.
3. As a reader, I want the imported PDF copied into the app's Library, so that moving, renaming, or deleting my original file doesn't break anything.
4. As a reader, I want re-importing a PDF that is already in my Library to open the existing Document with all its Highlights, so that I never end up with duplicates or lose my work.
5. As a reader, I want to be told "already in your Library" when that happens, so that I understand why no new Document appeared.
6. As a reader, I want a PDF with no selectable text (scanned/image-only) to be rejected with a clear message, so that I don't import something I can't highlight.
7. As a reader, I want a file that isn't a valid PDF to be rejected with a clear message, so that I know the import failed and why.
8. As a reader, I want a password-protected PDF to be rejected with a clear message, so that I'm not left with a broken Document.
9. As a reader, I want each Document's title and author taken from the PDF's metadata, so that my Library is readable without manual entry.
10. As a reader, I want the title to fall back to the original filename when the PDF has no title metadata, so that every Document has a recognizable name.
11. As a reader, I want to see my Library as a list showing each Document's title, author, page count, and number of Highlights, so that I can pick what to read next.
12. As a reader, I want the Library ordered with the most recently imported Document first, so that what I just added is at the top.
13. As a reader, I want to remove a Document from my Library after confirming, so that I can clean up mistaken imports; I understand its Highlights and Notes are removed with it.
14. As a reader, I want my Library, Highlights, and Notes to survive closing the browser and restarting the app, so that my work is durable.

### Reading

15. As a reader, I want to open a Document and see its pages rendered faithfully, so that reading in the app feels like reading the PDF.
16. As a reader, I want to scroll continuously through pages, so that I can read without paging manually.
17. As a reader, I want to see which page I'm on and the total page count, so that I can orient myself.
18. As a reader, I want to zoom in and out, so that I can read comfortably on my screen.
19. As a reader, I want to jump to a page number, so that I can navigate long Documents.
20. As a reader, I want pages with no text (e.g. a figure-only page) to still render, so that I can see them even though I can't highlight them.

### Highlighting

21. As a reader, I want to select text with my mouse and turn the selection into a Highlight with one click, so that capturing a passage is fast.
22. As a reader, I want a keyboard shortcut to turn the current selection into a Highlight, so that I don't have to reach for the mouse.
23. As a reader, I want a Highlight to cover exactly the text I selected, so that what is captured is what I chose.
24. As a reader, I want to select across a line break, a paragraph break, or a page break and get one Highlight, so that passages spanning layout boundaries stay whole.
25. As a reader, I want existing Highlights drawn over the text in a single highlight color, so that I can see what I've already marked.
26. As a reader, I want Highlights to reappear in the right place when I reopen a Document, so that my marks are reliable.
27. As a reader, I want the app to prevent a new Highlight that overlaps an existing one and tell me why, so that each passage is marked once.
28. As a reader, I want Highlights that merely touch (end where another begins) to be allowed, so that I can mark adjacent passages separately.
29. As a reader, I want selections containing only whitespace to be ignored, so that I don't create empty Highlights by accident.
30. As a reader, I want to delete a Highlight, so that I can remove a mark I no longer want; I understand its Note is deleted with it.
31. As a reader, I want to fix a wrongly-bounded Highlight by deleting it and highlighting again, so that correcting mistakes is possible without a separate edit mode.

### Notes

32. As a reader, I want to click a Highlight and attach a Note in my own words, so that I capture why the passage matters to me.
33. As a reader, I want to edit an existing Note, so that I can refine my thought as I keep reading.
34. As a reader, I want a Note to save when I leave the editor or press Cmd/Ctrl+Enter, so that I don't lose what I typed.
35. As a reader, I want clearing a Note's text and saving to remove the Note, so that removing a thought is natural.
36. As a reader, I want multi-line Notes with Markdown preserved as written, so that I can structure longer thoughts and have them come through intact in the Insight Export.
37. As a reader, I want Highlights with a Note visually distinguishable from Highlights without one, so that I can see where I've already written something.

### Sidebar / overview

38. As a reader, I want a sidebar listing all Highlights of the open Document in reading order, with page number, quoted text, and Note, so that I can review my reading at a glance.
39. As a reader, I want clicking a Highlight in the sidebar to scroll the reader to it, so that I can return to its context.

### Insight Export

40. As a reader, I want to produce an Insight Export for the open Document, so that I can hand my Highlights and Notes to an agent.
41. As a reader, I want to download the Insight Export as a Markdown file named after the Document, so that I can attach it or point an agent at it.
42. As a reader, I want to copy the Insight Export to my clipboard, so that I can paste it straight into an agent chat.
43. As a reader, I want the Insight Export to start with the Document's title and author and one line telling the agent what it is reading, so that the agent has context.
44. As a reader, I want Highlights in the Insight Export ordered by position in the Document, not by when I made them, so that the agent sees the material in the author's order.
45. As a reader, I want each Highlight in the Insight Export quoted exactly, with its page number (or page range when it crosses a page break), so that the agent can cite accurately.
46. As a reader, I want each Note placed directly under its Highlight in the Insight Export, so that my thoughts stay attached to the passage they're about.
47. As a reader, I want an Insight Export of a Document with no Highlights to still work and say there are none, so that the behavior is predictable.
48. As a reader, I want the Insight Export generated from saved data without reprocessing the PDF, so that it's instant and identical every time for the same Highlights and Notes.

### Running the app

49. As a reader, I want to start the whole app with one command and open it on localhost, so that using it has no setup friction.
50. As a reader, I want the app to work fully offline, so that my reading data never leaves my machine.

## Implementation Decisions

### Architecture and stack

- Single TypeScript package: a React + PDF.js browser client and a small Node HTTP server, sharing one domain module. One command builds and serves both on localhost. In development the client dev server proxies API calls to the Node server.
- PDF.js is pinned to one version and used on both sides: in the browser for rendering and the text layer, in Node for text extraction at import time.
- Persistence: a single SQLite file plus Library PDF files, both under a per-user app data directory. The data directory can be overridden by an environment variable; tests set it to a temporary directory.
- HTTP framework: a lightweight one that supports in-process request testing without opening a port (e.g. Hono's `app.request` or Fastify's `inject`), so the API seam can be exercised directly.
- No network calls, no auth, no telemetry.

### Modules

1. **Page Text** (shared, pure; the core of anchoring). Input: the ordered text items PDF.js extracts for a page. Output: that page's **canonical page text**, i.e. the item strings concatenated in order, with a line break appended after each item PDF.js marks as end-of-line. Also provides **quote derivation**: given canonical page texts and a start/end anchor, return the quoted text, built by slicing the range (joining page segments with a line break when it crosses pages), collapsing every whitespace run to a single space, and trimming. The browser and server must use this same module so anchors computed in the browser mean the same thing on the server.
2. **Library** (server). Import: compute the SHA-256 of the PDF bytes. If a Document with that hash exists, return it (not created). Otherwise parse with PDF.js and reject if the PDF isn't a PDF, is encrypted, or has zero non-whitespace characters across all pages. Then extract title/author from PDF metadata (title falls back to the original filename without extension; author may be null), store the bytes in the Library, and store the canonical page text for every page. Also covers list, get, get-file-bytes, and remove (which removes the bytes, page texts, Highlights, and Notes).
3. **Highlights & Notes** (server). Create a Highlight from a start and end anchor. Validate that both anchors are within bounds of the canonical page texts and that start comes before end in reading order. Derive the quote via Page Text and reject if it is empty after trimming. Reject if the range overlaps any existing Highlight in the Document. Persist anchors plus quote. Delete a Highlight (its Note goes with it). Put a Note (create or replace; whitespace-only text deletes it). Delete a Note.
4. **Insight Export** (server, pure given data). Input: Document metadata plus its Highlights with Notes. Output: a Markdown string (format below). Deterministic: no timestamps, no randomness.
5. **HTTP API** (server, thin). Maps routes to the modules above; owns status codes and error codes only.
6. **Reader UI** (browser). Library view (list, import via picker and drag-drop, remove with confirm, duplicate-import message). Reader view (PDF.js continuous-scroll rendering with text layer, page indicator, zoom, go-to-page). Selection mapping, which translates a DOM selection on the text layer into start/end anchors. Highlight overlays. Highlight action (button near the selection plus a keyboard shortcut). Note editor panel. Highlights sidebar. Export actions (download and copy).

### Anchors and reading order

- An **anchor** is `{page, offset}`: `page` is the 1-based physical page index, `offset` is a 0-based character offset into that page's canonical page text. A Highlight's range is `[start, end)`, with end exclusive.
- Reading order compares `(page, offset)` lexicographically. Highlights are always listed and exported sorted by start anchor.
- Two Highlights **overlap** if their ranges share at least one character. Touching ranges (one's end equals the other's start) do not overlap.
- No sentence snapping: the Highlight is exactly the selected range. Page numbers are physical page indices; PDF page labels (printed numbering such as roman numerals) are not used in v1.
- Browser selection mapping: each text-layer element corresponds to one PDF.js text item, whose start offset in the canonical page text is known. A selection endpoint maps to (item start offset + offset within the item). Endpoints that land outside a text item (between elements, on line-break elements, on page whitespace) snap to the nearest item boundary in the direction that shrinks the selection.

### Schema (SQLite)

- **documents**: id (= SHA-256 hex of the bytes; the Document's identity), title, author (nullable), original filename, page count, imported-at.
- **page_texts**: document id, page (1-based), canonical text. Primary key (document id, page). Cascade-deleted with the Document.
- **highlights**: id (opaque), document id, start page, start offset, end page, end offset, quote, created-at, note text (nullable), note updated-at (nullable). Cascade-deleted with the Document. Storing the Note on the Highlight row enforces "0 or 1 Note per Highlight" and makes deleting a Highlight delete its Note.
- Library PDF bytes are stored as files keyed by the Document id, not inside SQLite.

### HTTP API contract

All routes are under `/api`. Errors return `{ error: <stable code>, message: <human text> }`.

- `POST /api/documents`: multipart upload, field `file`. Returns `201 { document, created: true }` for a new Document, `200 { document, created: false }` for an existing one. Errors: `422 not_a_pdf`, `422 encrypted_pdf`, `422 no_text_layer`.
- `GET /api/documents`: `200 [document]`, newest import first.
- `GET /api/documents/:id`: `200 document`, or `404 document_not_found`.
- `GET /api/documents/:id/file`: the PDF bytes (`application/pdf`).
- `DELETE /api/documents/:id`: `204`.
- `GET /api/documents/:id/highlights`: `200 [highlight]` in reading order.
- `POST /api/documents/:id/highlights`: body `{ start: {page, offset}, end: {page, offset} }`. Returns `201 highlight`. Errors: `422 invalid_range` (out of bounds, or start not before end), `422 empty_highlight`, `409 overlapping_highlight`.
- `DELETE /api/highlights/:id`: `204`, or `404 highlight_not_found`.
- `PUT /api/highlights/:id/note`: body `{ text }`. Returns `200 highlight`. Whitespace-only text removes the Note.
- `DELETE /api/highlights/:id/note`: `200 highlight`.
- `GET /api/documents/:id/export`: `200` with `text/markdown` containing the Insight Export, and a `Content-Disposition` filename of the slugified title plus `-insights.md`.

Shapes:
- `document`: `{ id, title, author|null, pageCount, importedAt, highlightCount }`
- `highlight`: `{ id, documentId, start, end, quote, note: { text, updatedAt } | null, createdAt }`

### Insight Export format

- Line 1: `# <title>`.
- If an author is known: a line `Author: <author>`.
- One fixed context line telling the agent this is the reader's Highlights and Notes from that Document, in reading order.
- Then one block per Highlight in reading order, with blocks separated by a horizontal rule. Each block contains:
  - A bold page reference line: `p. N`, or `pp. N–M` when the Highlight crosses pages.
  - The quote as a single blockquote line.
  - If a Note exists, a paragraph starting with a bold `Note:` label followed by the Note text verbatim (multi-line and Markdown preserved).
- With zero Highlights, the blocks are replaced by a single italic "No highlights yet." line.
- The output ends with exactly one trailing newline.

## Testing Decisions

- **One automated seam: the HTTP API.** Tests send in-process HTTP requests to the server app and assert only on responses: status codes, JSON bodies, error codes, and the exact Markdown of the Insight Export. They never query SQLite directly, never call internal modules, and never assert on schema or file layout. If the internals are rewritten, the tests should not change.
- Each test gets a fresh temporary data directory (via the environment override) and a real SQLite file, and uses real PDF.js parsing. Nothing is mocked.
- **Fixtures**: small PDFs generated deterministically by a committed script, covering:
  - a multi-page text PDF with title/author metadata and a known sentence that crosses a page break
  - a text PDF with no metadata (title falls back to the filename)
  - an image-only PDF (no text layer)
  - an encrypted PDF
  - a non-PDF file

  Tests compute expected anchors from the fixture's known text.
- **Behaviors to cover through the API**:
  - Import: create, then re-import returns the same Document with `created: false`; bytes are retrievable; rejections for not_a_pdf, encrypted_pdf, and no_text_layer; title falls back to the filename; author is null when absent.
  - Listing order and `highlightCount`.
  - Highlights: single-line create with the exact quote; quote across a line break; quote across a page break; whitespace collapsing; invalid_range (out of bounds, reversed, zero-length); empty_highlight; overlapping_highlight; touching ranges allowed; reading-order listing regardless of creation order.
  - Notes: put, replace, whitespace-only removes, delete; deleting a Highlight removes its Note.
  - Removing a Document removes its Highlights, and re-importing it afterwards gives a fresh Document with no Highlights.
  - Persistence: a new app instance pointed at the same data directory returns the same Library and Highlights.
  - Insight Export: exact full-string assertions for (a) zero Highlights, (b) mixed Highlights with and without Notes, including a cross-page one and a multi-line Note, (c) a Document with no author.
- **Browser verification (not automated)**: before declaring done, the implementing agent verifies the Reader UI with Chrome DevTools MCP against a running app and the fixture PDFs:
  - import, and duplicate import
  - a single-line, a multi-line, and a cross-page selection each produce a Highlight whose quote (sidebar and API) exactly matches the selected text
  - an overlapping selection is blocked with a message
  - a Note is added, edited, and cleared
  - after a reload, Highlights reappear in the same place
  - download and copy produce Markdown identical to the export endpoint

  This covers browser selection mapping, which the API seam can't reach. If that mapping regresses later, add a Puppeteer test at that point.
- **Prior art**: none; the repo is greenfield. These API tests set the pattern for future specs.

## Out of Scope

- OCR / scanned or image-only PDFs; encrypted PDFs.
- Any in-app AI: summarizing, explaining a passage, chat.
- Tags, search (within or across Documents), multi-Document Insight Export.
- Multiple highlight colors; editing a Highlight's span; overlapping Highlights; sentence snapping.
- Notes not attached to a Highlight, or attached to several Highlights.
- PDF page labels (printed page numbers); de-hyphenating words broken across lines in quotes.
- Remembering reading position, reading stats or progress tracking.
- Writing annotations into the PDF, or exporting an annotated PDF copy (ADR-0001).
- Multi-user use, accounts, sync, cloud storage.
- Non-PDF formats (EPUB, etc.); mobile layouts; desktop packaging (Tauri can wrap the app later).
- Automated browser tests (see Testing Decisions).

## Further Notes

- Identity by content (ADR-0001) means a re-downloaded or different edition of the same book with different bytes is a new Document, and Highlights do not carry over. This is accepted.
- Quotes keep whatever hyphenation the PDF text contains (e.g. "read- ing" across a line break). This is acceptable for agent consumption in v1; de-hyphenation is a candidate follow-up.
- The PDF.js version must stay identical across browser and server. Canonical page text depends on PDF.js's item extraction, and an upgrade could shift offsets for already-stored anchors. Stored quotes are unaffected, and the Insight Export uses stored quotes only.
- Likely first follow-ups: tags; PDF page labels in the Insight Export; a Puppeteer test for selection mapping if it proves fragile.
