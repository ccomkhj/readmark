/** Shape guards for parsed request bodies. Bounds and domain rules stay in the modules. */
import type { Anchor } from "../../shared/api-types.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Shape check only; bounds are the Highlights module's job (`invalid_range`). */
export function isAnchor(value: unknown): value is Anchor {
  return isRecord(value) && typeof value["page"] === "number" && typeof value["offset"] === "number";
}
