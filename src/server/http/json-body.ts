/** Shared request-body helpers for the JSON routes. */
import type { Context } from "hono";
import { DomainError } from "../domain-error.ts";

/** The request's JSON body. Throws `bad_request` if it isn't JSON. */
export async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new DomainError("bad_request", "Expected a JSON body.");
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
