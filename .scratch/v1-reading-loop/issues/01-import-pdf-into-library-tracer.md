# 01: Import a PDF and see it in the Library (first end-to-end slice)

**What to build:** The thinnest end-to-end path through the whole app. I start the app with one command, open it on localhost, pick a PDF with the file picker, and it shows up in my Library list with its title, author, page count, and Highlight count (0). This ticket sets up the project for every later ticket: one TypeScript package with a React + PDF.js client, a small Node HTTP server, and a shared domain module. It also adds SQLite persistence under a per-user app data directory that an environment variable can override, PDF.js pinned to one version on both sides, the in-process API test harness, and the fixture-generation script. Happy-path import only. Duplicates, rejections, drag-and-drop, and removal come in later tickets.

See spec: `.scratch/v1-reading-loop/spec.md` (Architecture and stack, Modules 1–2, 5, Schema, HTTP API contract, Testing Decisions). See `GLOSSARY.md` and ADR-0001.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] One command builds and serves client + API on localhost; in development the client dev server proxies `/api` to the Node server
- [x] App works fully offline: no CDN or network calls (PDF.js worker, cmaps, standard fonts served locally); no auth, no telemetry
- [x] PDF.js is pinned to one exact version and used for browser rendering and Node text extraction
- [x] Data directory defaults to a per-user app data dir and can be overridden by an environment variable; it holds a single SQLite file plus Library PDF files keyed by Document id
- [x] HTTP framework supports in-process request testing without opening a port; API errors use `{ error, message }`
- [x] Page Text module (shared, pure): builds canonical page text from PDF.js text items (item strings concatenated in order, line break after each end-of-line item); used by import
- [x] `POST /api/documents` (multipart field `file`) for a new valid PDF: id = SHA-256 hex of the bytes; title/author from PDF metadata; page count; bytes copied into the Library; canonical page text stored for every page; returns `201 { document, created: true }`
- [x] `GET /api/documents` returns `200 [document]`, newest import first; `GET /api/documents/:id` returns `200 document` or `404 document_not_found`; `GET /api/documents/:id/file` returns the original bytes as `application/pdf`
- [x] `document` shape: `{ id, title, author|null, pageCount, importedAt, highlightCount }`
- [x] Committed, deterministic fixture script generates a multi-page text PDF with title/author metadata, a known sentence that crosses a page break, and one page with no text (figure-only), so the Reader can check that such pages render
- [x] API tests (fresh temp data dir per test, real SQLite, real PDF.js, no mocks) cover: create, retrieve bytes identical to upload, get by id, 404 for unknown id, list order across two imports
- [x] Library view lists Documents (title, author, page count, Highlight count) and imports via a file picker; the new Document appears at the top after import
