/** Typed client for the HTTP API. The only place the browser builds `/api` URLs. */
import type {
  Anchor,
  ApiErrorBody,
  DocumentDto,
  ErrorCode,
  CreateHighlightBody,
  HighlightDto,
  ImportResultDto,
  InsightExport,
  PutNoteBody,
  PutReadingPositionBody,
} from "../shared/api-types.ts";

/** A non-2xx API response. `code` is the stable error code from the server. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  throw new ApiError(res.status, body?.error ?? "unknown", body?.message ?? `Request failed (${res.status})`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  await throwIfNotOk(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listDocuments(): Promise<DocumentDto[]> {
  return request("/documents");
}

export function getDocument(id: string): Promise<DocumentDto> {
  return request(`/documents/${encodeURIComponent(id)}`);
}

export function importDocument(file: File): Promise<ImportResultDto> {
  const form = new FormData();
  form.append("file", file);
  return request("/documents", { method: "POST", body: form });
}

/** Removes the Document with its Highlights, Notes and stored PDF. */
export function removeDocument(id: string): Promise<void> {
  return request(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Records `page` as the Document's Reading Position. Rejects with `invalid_page`, `document_not_found`. */
export function putReadingPosition(id: string, page: number): Promise<DocumentDto> {
  return request(`/documents/${encodeURIComponent(id)}/reading-position`, json("PUT", { page } satisfies PutReadingPositionBody));
}

/** The Document's Highlights in reading order. */
export function listHighlights(documentId: string): Promise<HighlightDto[]> {
  return request(`/documents/${encodeURIComponent(documentId)}/highlights`);
}

/**
 * Creates a Highlight over `[start, end)`. Rejects with ApiError codes
 * `invalid_range`, `empty_highlight`, `overlapping_highlight`, `document_not_found`.
 */
export function createHighlight(documentId: string, start: Anchor, end: Anchor): Promise<HighlightDto> {
  return request(`/documents/${encodeURIComponent(documentId)}/highlights`, json("POST", { start, end } satisfies CreateHighlightBody));
}

/** Deletes the Highlight and its Note. */
export function deleteHighlight(highlightId: string): Promise<void> {
  return request(`/highlights/${encodeURIComponent(highlightId)}`, { method: "DELETE" });
}

/** Creates or replaces the Note (verbatim); whitespace-only text removes it. */
export function putNote(highlightId: string, text: string): Promise<HighlightDto> {
  return request(`/highlights/${encodeURIComponent(highlightId)}/note`, json("PUT", { text } satisfies PutNoteBody));
}

export function deleteNote(highlightId: string): Promise<HighlightDto> {
  return request(`/highlights/${encodeURIComponent(highlightId)}/note`, { method: "DELETE" });
}

/**
 * The Document's Insight Export: the Markdown exactly as the server rendered
 * it, plus the server's file name (from `Content-Disposition`).
 */
export async function getInsightExport(documentId: string): Promise<InsightExport> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/export`);
  await throwIfNotOk(res);
  const fileName = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
  if (!fileName) throw new Error("Export response has no Content-Disposition filename.");
  return { fileName, markdown: await res.text() };
}

/** URL of the Document's original PDF bytes, for PDF.js to load. */
export function documentFileUrl(id: string): string {
  return `/api/documents/${encodeURIComponent(id)}/file`;
}
