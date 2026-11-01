/** Wire shapes of the HTTP API (spec: "HTTP API contract"). Shared by server and client. */
import type { Anchor } from "./page-text.ts";

export type { Anchor };

export type DocumentDto = {
  /** SHA-256 hex of the PDF bytes (ADR-0001). */
  id: string;
  title: string;
  author: string | null;
  pageCount: number;
  /** ISO-8601 timestamp. */
  importedAt: string;
  highlightCount: number;
};

/** Response of `POST /api/documents`. */
export type ImportResultDto = { document: DocumentDto; created: boolean };

export type NoteDto = {
  /** Stored verbatim (multi-line and Markdown preserved). */
  text: string;
  /** ISO-8601 timestamp of the last put. */
  updatedAt: string;
};

/** A Highlight: the range `[start, end)` in reading order, with its derived quote. */
export type HighlightDto = {
  id: string;
  documentId: string;
  start: Anchor;
  end: Anchor;
  /** Derived from canonical page text at creation (Page Text `deriveQuote`). */
  quote: string;
  /** 0 or 1 Note per Highlight. */
  note: NoteDto | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
};

/** Body of `POST /api/documents/:id/highlights`. */
export type CreateHighlightBody = { start: Anchor; end: Anchor };

/** Body of `PUT /api/highlights/:id/note`. Whitespace-only text removes the Note. */
export type PutNoteBody = { text: string };

/** Stable error codes. Add new codes here; the HTTP layer maps each to a status. */
export type ErrorCode =
  | "document_not_found"
  | "bad_request"
  | "highlight_not_found"
  | "invalid_range"
  | "empty_highlight"
  | "overlapping_highlight";

/** Body of every non-2xx API response. */
export type ApiErrorBody = { error: ErrorCode; message: string };
