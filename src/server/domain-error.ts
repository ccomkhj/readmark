import type { ErrorCode } from "../shared/api-types.ts";

/**
 * Thrown by server modules (Library, Highlights & Notes) for expected failures.
 * Carries a stable code only; the HTTP layer (http/errors.ts) owns the status.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function documentNotFound(id: string): DomainError {
  return new DomainError("document_not_found", `No Document with id ${id}`);
}
