# 02: Import edge cases: duplicates, rejections, drag and drop

**What to build:** Importing behaves well in every case. Re-importing a PDF already in my Library opens the existing Document instead of creating a duplicate, and the UI tells me it was "already in your Library". A non-PDF file, a password-protected PDF, or a PDF with no selectable text is rejected with a clear message and nothing is added. A PDF without title metadata gets the original filename (without extension) as its title, and a missing author shows as unknown. I can also drag and drop a PDF onto the Library view to import it.

See spec: User Stories 2, 4–10; Modules 2 (Library); HTTP API contract for `POST /api/documents`.

**Blocked by:** 01 (Import a PDF and see it in the Library)

**Status:** ready-for-agent

- [ ] Re-importing identical bytes returns `200 { document, created: false }` with the same Document (same id, Highlights untouched); the Library shows no duplicate
- [ ] Library UI shows an "already in your Library" message on duplicate import
- [ ] Non-PDF input → `422 not_a_pdf`; encrypted PDF → `422 encrypted_pdf`; PDF with zero non-whitespace characters across all pages → `422 no_text_layer`; in each case no Document is created and no bytes are stored
- [ ] Each rejection shows a clear, human message in the Library UI
- [ ] Title falls back to the original filename without extension when metadata has no title; `author` is `null` when absent
- [ ] Drag-and-drop of a PDF onto the Library view imports it, same behavior as the file picker
- [ ] Fixture script additionally generates: a text PDF with no metadata, an image-only PDF, an encrypted PDF, and a non-PDF file (all deterministic, committed script)
- [ ] API tests cover: re-import returns `created: false` and the same Document; each of the three rejections; title fallback; author null
