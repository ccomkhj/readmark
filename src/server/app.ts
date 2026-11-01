/**
 * HTTP API composition root (spec Module 5). `createApp` wires the data dir,
 * SQLite, and modules into a Hono app. Tests drive it in-process via
 * `app.request(...)`; `main.ts` serves it on a port.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { openDb } from "./db.ts";
import { documentsRoutes } from "./http/documents-routes.ts";
import { handleError } from "./http/errors.ts";
import { createLibrary } from "./library.ts";

export type AppOptions = {
  /** Holds `book-reader.sqlite` and `library/<id>.pdf`. Created if missing. */
  dataDir: string;
};

export type App = Hono & {
  /** Closes the SQLite connection. */
  close(): void;
};

export function createApp({ dataDir }: AppOptions): App {
  mkdirSync(dataDir, { recursive: true });
  const db = openDb(join(dataDir, "book-reader.sqlite"));
  const library = createLibrary(db, dataDir);

  const api = new Hono();
  api.route("/documents", documentsRoutes(library));

  const app = new Hono();
  app.onError(handleError);
  app.route("/api", api);

  return Object.assign(app, { close: () => db.close() });
}
