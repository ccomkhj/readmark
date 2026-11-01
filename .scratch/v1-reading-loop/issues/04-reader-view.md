# 04: Reader view

**What to build:** From the Library I open a Document and read it in the browser: pages render faithfully in one continuous scroll, with a PDF.js text layer over each page so text can be selected (Highlighting is wired up in a later ticket). I can see the current page and total pages, zoom in and out, and jump to a page number. A page with no text (figure-only) still renders. I can return to the Library.

See spec: User Stories 15–20; Modules 6 (Reader UI: Reader view).

**Blocked by:** 01 (Import a PDF and see it in the Library)

**Status:** ready-for-agent

- [ ] Opening a Document from the Library shows its pages, rendered by PDF.js from the Document's file route
- [ ] Continuous vertical scrolling through all pages; rendering stays responsive on a long Document (e.g. render pages lazily as they near the viewport)
- [ ] Each page has a text layer aligned with the rendered text, and native text selection works on it
- [ ] Page indicator shows current page / total, and updates while scrolling
- [ ] Zoom in/out re-renders pages and text layer in alignment
- [ ] Go-to-page jumps to the requested page; out-of-range input is clamped or rejected with no crash
- [ ] The fixture's figure-only page renders
- [ ] Verified in the browser with Chrome DevTools MCP against a running app and the fixture PDFs
