import { Hono, type Context } from "hono";
import type { Anchor } from "../../shared/page-text.ts";
import { DomainError } from "../domain-error.ts";
import type { Highlights } from "../highlights.ts";

/** Routes under /api/documents/:id/highlights. Thin: parse request, call Highlights, pick status. */
export function documentHighlightsRoutes(highlights: Highlights): Hono {
  const routes = new Hono();

  routes.post("/", async (c) => {
    const body = await jsonBody(c);
    if (!isRecord(body) || !isAnchor(body["start"]) || !isAnchor(body["end"])) {
      throw new DomainError("bad_request", "Expected a JSON body `{ start: {page, offset}, end: {page, offset} }`.");
    }
    return c.json(highlights.create(documentId(c), body["start"], body["end"]), 201);
  });

  routes.get("/", (c) => c.json(highlights.list(documentId(c))));

  return routes;
}

/** Routes under /api/highlights. */
export function highlightsRoutes(highlights: Highlights): Hono {
  const routes = new Hono();

  routes.delete("/:id", (c) => {
    highlights.remove(c.req.param("id"));
    return c.body(null, 204);
  });

  routes.put("/:id/note", async (c) => {
    const body = await jsonBody(c);
    if (!isRecord(body) || typeof body["text"] !== "string") {
      throw new DomainError("bad_request", "Expected a JSON body `{ text: string }`.");
    }
    return c.json(highlights.putNote(c.req.param("id"), body["text"]));
  });

  routes.delete("/:id/note", (c) => c.json(highlights.removeNote(c.req.param("id"))));

  return routes;
}

function documentId(c: Context): string {
  const id = c.req.param("id");
  if (id === undefined) throw new Error("route mounted without :id");
  return id;
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new DomainError("bad_request", "Expected a JSON body.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Shape check only; bounds are the Highlights module's job (`invalid_range`). */
function isAnchor(value: unknown): value is Anchor {
  return isRecord(value) && typeof value["page"] === "number" && typeof value["offset"] === "number";
}
