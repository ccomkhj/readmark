import { describe, expect, it } from "vitest";
import { SAMPLE, SECOND } from "../fixtures/definitions.ts";
import { fixtureId, importFixture, readFixture, useTestApp } from "./harness.ts";

const app = useTestApp();
const UNKNOWN_ID = "0".repeat(64);

describe("POST /api/documents", () => {
  it("imports a new PDF into the Library", async () => {
    const res = await importFixture(app.get(), SAMPLE);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      created: true,
      document: {
        id: await fixtureId(SAMPLE),
        title: "The Art of Reading",
        author: "Ada Lovelace",
        pageCount: 5,
        importedAt: expect.any(String),
        highlightCount: 0,
      },
    });
    expect(Number.isNaN(Date.parse(body.document.importedAt))).toBe(false);
  });
});

describe("GET /api/documents/:id/file", () => {
  it("returns the original bytes as application/pdf", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);

    const res = await t.request(`/api/documents/${await fixtureId(SAMPLE)}/file`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(await readFixture(SAMPLE));
  });

  it("returns 404 document_not_found for an unknown id", async () => {
    const res = await app.get().request(`/api/documents/${UNKNOWN_ID}/file`);

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("document_not_found");
  });
});

describe("GET /api/documents/:id", () => {
  it("returns the imported Document", async () => {
    const t = app.get();
    const { document } = await (await importFixture(t, SAMPLE)).json();

    const res = await t.request(`/api/documents/${document.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(document);
  });

  it("returns 404 document_not_found with a message for an unknown id", async () => {
    const res = await app.get().request(`/api/documents/${UNKNOWN_ID}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "document_not_found", message: expect.any(String) });
  });
});

describe("GET /api/documents", () => {
  it("is empty for a new Library", async () => {
    const res = await app.get().request("/api/documents");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("lists Documents newest import first", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);
    await importFixture(t, SECOND);

    const res = await t.request("/api/documents");

    expect(res.status).toBe(200);
    const docs = await res.json();
    expect(docs.map((d: { title: string }) => d.title)).toEqual(["A Second Book", "The Art of Reading"]);
    expect(docs[0]).toEqual({
      id: await fixtureId(SECOND),
      title: "A Second Book",
      author: "Grace Hopper",
      pageCount: 2,
      importedAt: expect.any(String),
      highlightCount: 0,
    });
  });
});
