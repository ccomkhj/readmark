/**
 * Production entry point: serves the HTTP API plus the built client
 * (dist/client) on localhost. `npm start` builds the client first.
 */
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { resolveDataDir } from "./data-dir.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4310);
const CLIENT_DIR = join(import.meta.dirname, "..", "..", "dist", "client");

const dataDir = resolveDataDir();
const app = createApp({ dataDir });

if (existsSync(CLIENT_DIR)) {
  // serveStatic resolves `root` against the cwd.
  const root = relative(process.cwd(), CLIENT_DIR) || ".";
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

const server = serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`Readmark on http://${HOST}:${info.port}  (data: ${dataDir})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    app.close();
    process.exit(0);
  });
}
