# 04: Reader view

**What to build:** From the Library I open a Document and read it in the browser: pages render faithfully in one continuous scroll, with a PDF.js text layer over each page so text can be selected (Highlighting is wired up in a later ticket). I can see the current page and total pages, zoom in and out, and jump to a page number. A page with no text (figure-only) still renders. I can return to the Library.

See spec: User Stories 15–20; Modules 6 (Reader UI: Reader view).

**Blocked by:** 01 (Import a PDF and see it in the Library)

**Status:** resolved

- [x] Opening a Document from the Library shows its pages, rendered by PDF.js from the Document's file route
- [x] Continuous vertical scrolling through all pages; rendering stays responsive on a long Document (e.g. render pages lazily as they near the viewport)
- [x] Each page has a text layer aligned with the rendered text, and native text selection works on it
- [x] Page indicator shows current page / total, and updates while scrolling
- [x] Zoom in/out re-renders pages and text layer in alignment
- [x] Go-to-page jumps to the requested page; out-of-range input is clamped or rejected with no crash
- [x] The fixture's figure-only page renders
- [x] Verified in the browser with Chrome DevTools MCP against a running app and the fixture PDFs

_Verification note:_ the DevTools MCP browser was held by another session, so verification drove an isolated headless Chrome over CDP (same protocol) against `npm start` with both fixtures plus a 400-page generated PDF: text-layer alignment screenshots at 50% / 125% / 300%, native mouse selection, page indicator while scrolling, go-to-page with 4 / 99 / 0 / -3 / "abc", figure-only page 4, back to Library, unknown id error. No console errors, no external requests.
