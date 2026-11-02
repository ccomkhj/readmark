# Reading Position

Status: resolved

## Problem

Closing the Reader or restarting the app loses the reader's place: they have to remember which Document they were reading and scroll back to the page.

## User stories

1. When I reopen a Document, it opens at the page I was last on.
2. The Library offers "Continue reading" for the Document I read most recently, with its page.
3. Each Library row shows the page I'm on in that Document, if I've opened it.
4. My Reading Positions survive an app restart (stored server-side with the Library, not in the browser).

## Design

- Storage: `documents.last_read_page` + `documents.last_read_at` (migration 2); both null until first opened.
- API: `PUT /api/documents/:id/reading-position` `{ page }` → the updated `DocumentDto`. `DocumentDto.readingPosition` is `{ page, updatedAt } | null`. Errors: `400 bad_request` (shape), `422 invalid_page` (not an integer in `1..pageCount`), `404 document_not_found`.
- Reader (`use-reading-position.ts`): after opening, scrolls to the saved page, then saves the current page once (opening counts as reading), after each page change once scrolling settles (1 s), and on leaving the Reader. A failed save shows a toast.
- Page granularity only, not the offset within the page.

## Out of scope

- Reading stats, progress bars, time spent.
- Saving the pending page when the tab is closed within the 1 s settle window.
- Restoring zoom level.
