/** Reads a JSON request body. Shape guards live in guards.ts. */
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
