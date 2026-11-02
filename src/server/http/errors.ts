import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody, ErrorCode } from "../../shared/api-types.ts";
import { DomainError } from "../domain-error.ts";

/** HTTP status for each stable error code. The only place statuses for errors live. */
const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  bad_request: 400,
  document_not_found: 404,
  highlight_not_found: 404,
  invalid_range: 422,
  empty_highlight: 422,
  overlapping_highlight: 409,
  not_a_pdf: 422,
  encrypted_pdf: 422,
  no_text_layer: 422,
  invalid_page: 422,
};

function errorResponse(c: Context, code: ErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: code, message };
  return c.json(body, STATUS[code]);
}

/** Hono `onError` handler: DomainError -> `{ error, message }`; anything else rethrows (500). */
export function handleError(err: Error, c: Context): Response {
  if (err instanceof DomainError) return errorResponse(c, err.code, err.message);
  throw err;
}
