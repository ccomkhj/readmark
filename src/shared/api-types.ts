/** Wire shapes of the HTTP API (spec: "HTTP API contract"). Shared by server and client. */

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

/** Stable error codes. Add new codes here; the HTTP layer maps each to a status. */
export type ErrorCode = "document_not_found" | "bad_request";

/** Body of every non-2xx API response. */
export type ApiErrorBody = { error: ErrorCode; message: string };
