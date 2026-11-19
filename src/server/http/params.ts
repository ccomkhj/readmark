import type { Context } from "hono";

/** The `:id` of a route mounted under /documents/:id. A missing param is a wiring bug, not a bad request. */
export function documentIdParam(c: Context): string {
  const id = c.req.param("id");
  if (id === undefined) throw new Error("route mounted without :id");
  return id;
}
