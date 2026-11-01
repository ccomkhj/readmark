import { describe, expect, it } from "vitest";
import { SAMPLE, SECOND } from "../fixtures/definitions.ts";
import { createTestApp, fixtureId, importFixture, useTestApp } from "./harness.ts";

const app = useTestApp();
const UNKNOWN_ID = "0".repeat(64);

describe("DELETE /api/documents/:id", () => {
  it("removes the Document from get, file and list", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);
    await importFixture(t, SECOND);
    const id = await fixtureId(SAMPLE);

    const res = await t.request(`/api/documents/${id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    const get = await t.request(`/api/documents/${id}`);
    expect(get.status).toBe(404);
    expect((await get.json()).error).toBe("document_not_found");
    const file = await t.request(`/api/documents/${id}/file`);
    expect(file.status).toBe(404);
    expect((await file.json()).error).toBe("document_not_found");
    const list = await (await t.request("/api/documents")).json();
    expect(list.map((d: { title: string }) => d.title)).toEqual(["A Second Book"]);
  });

  it("returns 404 document_not_found for an unknown id", async () => {
    const res = await app.get().request(`/api/documents/${UNKNOWN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "document_not_found", message: expect.any(String) });
  });

  it("lets a removed PDF be imported again as a fresh Document", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);
    const id = await fixtureId(SAMPLE);
    await t.request(`/api/documents/${id}`, { method: "DELETE" });

    const res = await importFixture(t, SAMPLE);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      created: true,
      document: expect.objectContaining({ id, title: "The Art of Reading", pageCount: 5, highlightCount: 0 }),
    });
    expect((await t.request(`/api/documents/${id}/file`)).status).toBe(200);
  });
});

describe("Library durability", () => {
  it("a new app instance on the same data directory shows the same Library", async () => {
    const first = app.get();
    await importFixture(first, SAMPLE);
    await importFixture(first, SECOND);
    const before = await (await first.request("/api/documents")).json();
    first.stop();

    const second = await createTestApp(first.dataDir);
    try {
      const after = await (await second.request("/api/documents")).json();
      expect(after.map((d: { id: string; title: string }) => [d.id, d.title])).toEqual([
        [await fixtureId(SECOND), "A Second Book"],
        [await fixtureId(SAMPLE), "The Art of Reading"],
      ]);
      expect(after).toEqual(before);
      expect((await second.request(`/api/documents/${await fixtureId(SAMPLE)}/file`)).status).toBe(200);
    } finally {
      second.stop();
    }
  });
});
