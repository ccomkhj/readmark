/**
 * Production entry point: serves the HTTP API plus the built client
 * (dist/client) on localhost. `npm start` builds the client first.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { resolveDataDir } from "./data-dir.ts";
import { clientDir, serveClient } from "./serve-client.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4310);
const CLIENT_DIR = clientDir(join(import.meta.dirname, "..", ".."));

const dataDir = resolveDataDir();
const app = createApp({ dataDir });

// `npm run dev` runs this without a build (Vite serves the client).
if (existsSync(CLIENT_DIR)) serveClient(app, CLIENT_DIR);

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
