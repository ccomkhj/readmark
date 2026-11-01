# 06: Highlight a selection in the Reader

**What to build:** While reading, I select text with the mouse (within a line, across lines or paragraphs, or across a page break) and turn it into a Highlight with one click on a button near the selection, or with a keyboard shortcut. The Highlight covers exactly what I selected and is drawn over the text in a single highlight color. When I reopen or reload the Document, my Highlights reappear in the same place. If the selection overlaps an existing Highlight, the app blocks it and tells me why. Whitespace-only selections create nothing.

See spec: User Stories 21–29; Anchors and reading order (Browser selection mapping); Modules 6 (Reader UI: selection mapping, overlays, Highlight action); Testing Decisions (Browser verification).

**Blocked by:** 04 (Reader view), 05 (Highlights & Notes API)

**Status:** ready-for-agent

- [ ] Selection mapping: each text-layer element corresponds to one PDF.js text item with a known start offset in the canonical page text (same shared Page Text module as the server); a selection endpoint maps to item start offset + offset within the item
- [ ] Endpoints landing outside a text item (between elements, on line-break elements, on page whitespace) snap to the nearest item boundary in the direction that shrinks the selection
- [ ] Highlight button appears near a non-empty selection; a keyboard shortcut does the same; both create the Highlight via the API
- [ ] Whitespace-only selections create nothing (no button, or a no-op), with no error
- [ ] `409 overlapping_highlight` (and any other API error) shows a clear message; the selection is not turned into a Highlight
- [ ] Highlights render as overlays in a single color, correctly placed at every zoom level and across page breaks
- [ ] After reload, Highlights reappear in the same place
- [ ] Library Highlight count reflects new Highlights
- [ ] Verified with Chrome DevTools MCP against a running app and the fixture PDFs: a single-line, a multi-line, and a cross-page selection each produce a Highlight whose quote (API) exactly matches the selected text; an overlapping selection is blocked with a message; Highlights reappear in place after reload
