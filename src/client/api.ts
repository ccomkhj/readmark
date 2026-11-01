/** Typed client for the HTTP API. The only place the browser builds `/api` URLs. */
import type { ApiErrorBody, DocumentDto, ErrorCode, ImportResultDto } from "../shared/api-types.ts";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error ?? "unknown", body?.message ?? `Request failed (${res.status})`);
  }
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

/** URL of the Document's original PDF bytes, for PDF.js to load. */
export function documentFileUrl(id: string): string {
  return `/api/documents/${encodeURIComponent(id)}/file`;
}
