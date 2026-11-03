/**
 * Serves the built client (dist/client) from a Hono app, with an SPA
 * fallback to index.html. Shared by the HTTP entry point (main.ts) and the
 * desktop shell (src/desktop/main.ts).
 */
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

/** dist/client, resolved from the repo (or app bundle) root. */
export function clientDir(root: string): string {
  return join(root, "dist", "client");
}

/** Precondition: `dir` holds a built client (`npm run build`). */
export function serveClient(app: Hono, dir: string): void {
  if (!existsSync(join(dir, "index.html"))) {
    throw new Error(`No built client at ${dir}; run \`npm run build\` first.`);
  }
  // serveStatic resolves `root` against the cwd.
  const root = relative(process.cwd(), dir) || ".";
  // Hashed bundles never change; everything else (index.html) must be
  // revalidated, or a rebuilt app keeps loading the old bundle.
  app.use("/*", async (c, next) => {
    await next();
    const immutable = c.req.path.startsWith("/assets/");
    c.header("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
  });
  app.use("/*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}
