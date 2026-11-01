# 08: Highlights sidebar

**What to build:** Next to the open Document, a sidebar lists all its Highlights in reading order. Each entry shows the page number (or page range when it crosses a page break), the quoted text, and the Note if there is one. Clicking an entry scrolls the Reader to that Highlight so I can see its context.

See spec: User Stories 38–39; Modules 6 (Reader UI: Highlights sidebar).

**Blocked by:** 06 (Highlight a selection in the Reader)

**Status:** resolved

- [x] Sidebar lists the open Document's Highlights in reading order (by start anchor), not creation order
- [x] Each entry shows page reference (single page, or range for cross-page Highlights), the quote, and the Note text when present
- [x] Sidebar updates when Highlights are created or deleted, and when Notes change (Notes can be set via the API if ticket 07 hasn't landed)
- [x] Clicking an entry scrolls the Reader to the Highlight (rendering the target page if needed)
- [x] Empty state when the Document has no Highlights
- [x] Verified with Chrome DevTools MCP: sidebar quotes exactly match the API quotes for single-line, multi-line, and cross-page Highlights; clicking an entry scrolls to it

_Verified over CDP with headless Chrome (DevTools MCP held by another session): sidebar entries equal API page/quote/note for single-line, multi-line and cross-page Highlights (created out of reading order); click scrolls each Highlight to ~100px below the viewport top, incl. unrendered pages at 400%._
