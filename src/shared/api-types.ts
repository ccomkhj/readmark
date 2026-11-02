/** Wire shapes of the HTTP API (spec: "HTTP API contract"). Shared by server and client. */
import type { Anchor, TextRange } from "./page-text.ts";

export type { Anchor, TextRange };

export type DocumentDto = {
  /** SHA-256 hex of the PDF bytes (ADR-0001). */
  id: string;
  title: string;
  author: string | null;
  pageCount: number;
  /** ISO-8601 timestamp. */
  importedAt: string;
  highlightCount: number;
  /** Where the reader last was; null if the Document was never opened. */
  readingPosition: ReadingPositionDto | null;
};

/** A Document's Reading Position: the page last read, and when. */
export type ReadingPositionDto = {
  /** 1-based physical page, in `1..pageCount`. */
  page: number;
  /** ISO-8601 timestamp of the last put. */
  updatedAt: string;
};

/** Body of `PUT /api/documents/:id/reading-position`. */
export type PutReadingPositionBody = { page: number };

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
  /**
   * The body-text parts of `[start, end)`: split at page breaks, page
   * furniture left out, whitespace-trimmed, in reading order (Page Text
   * `bodySegments`). At least one. Overlays draw these, not `start`/`end`.
   */
  segments: TextRange[];
  /** Derived from canonical page text at creation, page furniture excluded (Page Text `deriveQuote`). */
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

/** An Insight Export. `GET /api/documents/:id/export` sends `markdown` as the body and `fileName` in `Content-Disposition`. */
export type InsightExport = { fileName: string; markdown: string };

/** Stable error codes. Add new codes here; the HTTP layer maps each to a status. */
export type ErrorCode =
  | "document_not_found"
  | "bad_request"
  | "highlight_not_found"
  | "invalid_range"
  | "empty_highlight"
  | "overlapping_highlight"
  | "not_a_pdf"
  | "encrypted_pdf"
  | "no_text_layer"
  | "invalid_page";

/** Body of every non-2xx API response. */
export type ApiErrorBody = { error: ErrorCode; message: string };
