import { Hono } from "hono";
import type { Library } from "../library.ts";
import { DomainError } from "../domain-error.ts";

/** Routes under /api/documents. Thin: parse request, call Library, pick status. */
export function documentsRoutes(library: Library): Hono {
  const routes = new Hono();

  routes.post("/", async (c) => {
    const form = await c.req.parseBody();
    const file = form["file"];
    if (!(file instanceof File)) {
      throw new DomainError("bad_request", "Expected a multipart upload with a `file` field.");
    }
    const result = await library.importPdf(new Uint8Array(await file.arrayBuffer()), file.name);
    return c.json(result, result.created ? 201 : 200);
  });

  routes.get("/", (c) => c.json(library.list()));

  routes.get("/:id", (c) => c.json(library.get(c.req.param("id"))));

  routes.delete("/:id", async (c) => {
    await library.remove(c.req.param("id"));
    return c.body(null, 204);
  });

  routes.get("/:id/file", async (c) => {
    const bytes = await library.fileBytes(c.req.param("id"));
    return c.body(bytes, 200, { "Content-Type": "application/pdf" });
  });

  return routes;
}
