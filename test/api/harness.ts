/**
 * In-process API test harness. Tests talk to the server only through HTTP
 * requests (`app.request`), never through internal modules or SQLite.
 *
 *   const t = await createTestApp();        // fresh temp data dir
 *   const res = await importFixture(t, SAMPLE);
 *   await t.close();                        // closes DB, deletes temp dir
 *
 * Or let vitest manage lifetime with `useTestApp()` inside a describe/file.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { createApp, type App } from "../../src/server/app.ts";
import type { Fixture } from "../fixtures/definitions.ts";

export type TestApp = {
  dataDir: string;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  /** Close the app but keep the data dir (e.g. to reopen it in a new instance). */
  stop: () => void;
  /** Close the app and delete its data dir. */
  close: () => Promise<void>;
};

/** Start an app instance on `dataDir`, or on a fresh temp dir if omitted. */
export async function createTestApp(dataDir?: string): Promise<TestApp> {
  const dir = dataDir ?? (await mkdtemp(join(tmpdir(), "readmark-test-")));
  const app: App = createApp({ dataDir: dir });
  let stopped = false;
  const stop = () => {
    if (!stopped) app.close();
    stopped = true;
  };
  return {
    dataDir: dir,
    request: (path, init) => Promise.resolve(app.request(path, init)),
    stop,
    close: async () => {
      stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** Registers beforeEach/afterEach; call `get()` inside a test for that test's app. */
export function useTestApp(): { get: () => TestApp } {
  let current: TestApp | undefined;
  beforeEach(async () => {
    current = await createTestApp();
  });
  afterEach(async () => {
    await current?.close();
    current = undefined;
  });
  return {
    get: () => {
      if (!current) throw new Error("useTestApp().get() called outside a test");
      return current;
    },
  };
}

const FIXTURE_DIR = join(import.meta.dirname, "..", "fixtures");

export async function readFixture(fixture: Fixture): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await readFile(join(FIXTURE_DIR, fixture.fileName)));
}

/** Expected Document id: SHA-256 hex of the fixture bytes. */
export async function fixtureId(fixture: Fixture): Promise<string> {
  return createHash("sha256").update(await readFixture(fixture)).digest("hex");
}

/** POST /api/documents with raw bytes as multipart field `file`. */
export function uploadBytes(t: TestApp, bytes: Uint8Array<ArrayBuffer>, fileName: string): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: "application/pdf" }));
  return t.request("/api/documents", { method: "POST", body: form });
}

/** POST /api/documents with a fixture file. */
export async function importFixture(t: TestApp, fixture: Fixture): Promise<Response> {
  return uploadBytes(t, await readFixture(fixture), fixture.fileName);
}
