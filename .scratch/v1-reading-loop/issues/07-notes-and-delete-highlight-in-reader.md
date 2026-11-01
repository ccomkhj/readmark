# 07: Notes and deleting Highlights in the Reader

**What to build:** I click a Highlight in the Reader and a Note editor opens for it. I write a thought in my own words (multi-line, Markdown kept as written) and it saves when I leave the editor or press Cmd/Ctrl+Enter. I can edit it later, and clearing the text and saving removes the Note. Highlights that have a Note look visibly different from ones that don't. From the same place I can delete the Highlight (its Note goes with it), which is how I fix a wrongly-bounded Highlight: delete it and highlight again.

See spec: User Stories 30–37; Modules 6 (Reader UI: Note editor panel).

**Blocked by:** 06 (Highlight a selection in the Reader)

**Status:** ready-for-agent

- [ ] Clicking a Highlight overlay opens a Note editor for that Highlight, showing its quote and existing Note text if any
- [ ] Note saves on blur and on Cmd/Ctrl+Enter via the Note API; multi-line text and Markdown are stored verbatim
- [ ] Clearing the text (or leaving only whitespace) and saving removes the Note
- [ ] Highlights with a Note are visually distinguishable from Highlights without one, and update immediately after save/clear
- [ ] Deleting a Highlight removes its overlay and its Note; the Library Highlight count reflects it
- [ ] If the sidebar (ticket 08) exists, it stays in sync with Note and Highlight changes
- [ ] Verified with Chrome DevTools MCP: a Note is added, edited, and cleared; state matches the API after reload; a Highlight is deleted and the same text can be highlighted again
