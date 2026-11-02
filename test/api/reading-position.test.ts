import { describe, expect, it } from "vitest";
import { SAMPLE, SECOND } from "../fixtures/definitions.ts";
import { createTestApp, importFixture, useTestApp, type TestApp } from "./harness.ts";

const app = useTestApp();
const UNKNOWN_ID = "0".repeat(64);

const putPosition = (t: TestApp, id: string, body: unknown) =>
  t.request(`/api/documents/${id}/reading-position`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function importId(t: TestApp, fixture = SAMPLE): Promise<string> {
  return (await (await importFixture(t, fixture)).json()).document.id;
}

describe("PUT /api/documents/:id/reading-position", () => {
  it("a newly imported Document has no Reading Position", async () => {
    const t = app.get();
    const id = await importId(t);
    expect((await (await t.request(`/api/documents/${id}`)).json()).readingPosition).toBeNull();
  });

  it("records the page and returns the Document with it; get and list show it", async () => {
    const t = app.get();
    const id = await importId(t);

    const res = await putPosition(t, id, { page: 3 });

    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.readingPosition).toEqual({ page: 3, updatedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(doc.readingPosition.updatedAt))).toBe(false);
    expect(await (await t.request(`/api/documents/${id}`)).json()).toEqual(doc);
    expect(await (await t.request("/api/documents")).json()).toEqual([doc]);
  });

  it("a later put replaces the page and moves updatedAt forward", async () => {
    const t = app.get();
    const id = await importId(t);
    const first = (await (await putPosition(t, id, { page: 4 })).json()).readingPosition;

    const second = (await (await putPosition(t, id, { page: 2 })).json()).readingPosition;

    expect(second.page).toBe(2);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
  });

  it("only touches its own Document", async () => {
    const t = app.get();
    const a = await importId(t, SAMPLE);
    const b = await importId(t, SECOND);

    await putPosition(t, a, { page: 2 });

    expect((await (await t.request(`/api/documents/${b}`)).json()).readingPosition).toBeNull();
  });

  it.each([0, -1, 6, 2.5])("rejects page %s outside 1..pageCount with 422 invalid_page", async (page) => {
    const t = app.get();
    const id = await importId(t);

    const res = await putPosition(t, id, { page });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_page");
    expect((await (await t.request(`/api/documents/${id}`)).json()).readingPosition).toBeNull();
  });

  it.each([{}, { page: "3" }, [3], null])("rejects body %j with 400 bad_request", async (body) => {
    const t = app.get();
    const res = await putPosition(t, await importId(t), body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });

  it("returns 404 document_not_found for an unknown Document", async () => {
    const res = await putPosition(app.get(), UNKNOWN_ID, { page: 1 });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("document_not_found");
  });

  it("survives a restart on the same data directory", async () => {
    const first = await createTestApp();
    try {
      const id = await importId(first);
      const saved = await (await putPosition(first, id, { page: 5 })).json();
      first.stop();

      const second = await createTestApp(first.dataDir);
      try {
        expect(await (await second.request(`/api/documents/${id}`)).json()).toEqual(saved);
      } finally {
        second.stop();
      }
    } finally {
      await first.close();
    }
  });
});
