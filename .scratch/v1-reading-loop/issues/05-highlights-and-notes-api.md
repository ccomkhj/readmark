# 05: Highlights & Notes API

**What to build:** The server side of Highlighting and Notes, tested entirely through the HTTP API. Given a start and end anchor, the API creates a Highlight whose quote is derived exactly from the stored canonical page text. It rejects ranges that are out of bounds, reversed, zero-length, whitespace-only, or overlapping an existing Highlight, and it lists Highlights in reading order. Highlights can be deleted (their Note goes with them), and a Highlight's Note can be set, replaced, or removed. The Library's Highlight count reflects reality, removing a Document removes its Highlights, and everything survives a restart. The Reader UI for all this comes in later tickets. This ticket is the contract they build on.

See spec: Modules 1 (Page Text: quote derivation) and 3 (Highlights & Notes); Anchors and reading order; Schema (`highlights`); HTTP API contract; Testing Decisions.

**Blocked by:** 01 (Import a PDF and see it in the Library), 03 (Remove a Document; Library survives restart)

**Status:** resolved

- [x] Page Text module gains quote derivation: slice the `[start, end)` range across canonical page texts (joining page segments with a line break when it crosses pages), collapse every whitespace run to a single space, trim. Shared module, usable by the browser
- [x] Anchor is `{page, offset}` (1-based physical page, 0-based offset into canonical page text); reading order compares `(page, offset)` lexicographically
- [x] `POST /api/documents/:id/highlights` with `{ start, end }` returns `201 highlight`; `highlight` shape: `{ id, documentId, start, end, quote, note: { text, updatedAt } | null, createdAt }`
- [x] Errors: `422 invalid_range` (out of bounds, start not before end, zero-length); `422 empty_highlight` (quote empty after trimming); `409 overlapping_highlight` (shares at least one character with an existing Highlight); `404 document_not_found` for unknown Document
- [x] Touching ranges (one's end equals another's start) are allowed
- [x] `GET /api/documents/:id/highlights` returns `200 [highlight]` sorted by start anchor regardless of creation order
- [x] `DELETE /api/highlights/:id` returns `204`, or `404 highlight_not_found`; the Note goes with it
- [x] `PUT /api/highlights/:id/note` with `{ text }` creates or replaces the Note (text stored verbatim, multi-line and Markdown preserved) and returns `200 highlight`; whitespace-only text removes the Note
- [x] `DELETE /api/highlights/:id/note` returns `200 highlight` with `note: null`
- [x] Note is stored on the Highlight row (0 or 1 Note per Highlight); Highlights cascade-delete with their Document
- [x] `highlightCount` in `document` (list and get) reflects the current number of Highlights
- [x] API tests (expected anchors computed from the fixture's known text): single-line exact quote; quote across a line break; quote across a page break; whitespace collapsing; invalid_range (out of bounds, reversed, zero-length); empty_highlight; overlapping_highlight; touching allowed; reading-order listing; Note put / replace / whitespace-only removes / delete; deleting a Highlight removes its Note; `highlightCount`
- [x] API tests: removing a Document removes its Highlights, and re-importing afterwards gives a fresh Document with no Highlights; a new app instance on the same data directory returns the same Highlights and Notes
