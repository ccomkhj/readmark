import { Hono } from "hono";
import type { Highlights } from "../highlights.ts";
import { insightExport } from "../insight-export.ts";
import type { Library } from "../library.ts";

/** Route mounted at /api/documents/:id/export. Thin: gather data, render, set headers. */
export function exportRoutes(library: Library, highlights: Highlights): Hono {
  const routes = new Hono();

  routes.get("/", (c) => {
    const id = c.req.param("id")!;
    const { fileName, markdown } = insightExport(library.get(id), highlights.list(id));
    return c.body(markdown, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
  });

  return routes;
}
