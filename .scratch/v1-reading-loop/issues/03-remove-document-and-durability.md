# 03: Remove a Document; Library survives restart

**What to build:** I can remove a mistaken import from my Library after confirming, and the Document, its stored bytes, and its page text are gone. Separately, my Library is durable: stopping and restarting the app (a new server instance on the same data directory) shows the same Library.

See spec: User Stories 13–14; Modules 2 (Library: remove); HTTP API contract for `DELETE /api/documents/:id`.

**Blocked by:** 01 (Import a PDF and see it in the Library)

**Status:** resolved

- [x] `DELETE /api/documents/:id` returns `204`; afterwards `GET /api/documents/:id` is `404 document_not_found`, its file route no longer serves bytes, and it is absent from the list
- [x] Removal deletes the stored PDF bytes and page texts (the schema cascades from the Document so later Highlight data goes with it)
- [x] Re-importing a removed PDF creates a fresh Document (`201`, `created: true`)
- [x] Library UI offers remove per Document behind a confirmation that says its Highlights and Notes will be removed too; cancelling does nothing
- [x] API test: a new app instance pointed at the same data directory returns the same Library (ids, titles, order)
- [x] API tests cover remove and re-import after remove
