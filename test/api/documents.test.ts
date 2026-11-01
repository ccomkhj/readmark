import { describe, expect, it } from "vitest";
import { ENCRYPTED, IMAGE_ONLY, NOT_A_PDF, NO_METADATA, SAMPLE, SECOND, type Fixture } from "../fixtures/definitions.ts";
import { fixtureId, importFixture, readFixture, uploadBytes, useTestApp } from "./harness.ts";

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

  it("re-importing identical bytes returns the existing Document without a duplicate", async () => {
    const t = app.get();
    const first = await (await importFixture(t, SAMPLE)).json();

    const res = await uploadBytes(t, await readFixture(SAMPLE), "renamed copy.pdf");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: false, document: first.document });
    const list = await (await t.request("/api/documents")).json();
    expect(list).toEqual([first.document]);
  });

  it("two concurrent uploads of identical bytes yield one Document: one 201, one 200", async () => {
    const t = app.get();
    const bytes = await readFixture(SAMPLE);

    const responses = await Promise.all([uploadBytes(t, bytes, "a.pdf"), uploadBytes(t, bytes, "b.pdf")]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const id = await fixtureId(SAMPLE);
    expect(bodies.map((b) => b.document.id)).toEqual([id, id]);
    expect(await (await t.request("/api/documents")).json()).toHaveLength(1);
  });

  it("falls back to the filename without extension for the title, and a null author, when metadata is absent", async () => {
    const res = await uploadBytes(app.get(), await readFixture(NO_METADATA), "My Reading Notes.v2.pdf");

    expect(res.status).toBe(201);
    const { document } = await res.json();
    expect(document.title).toBe("My Reading Notes.v2");
    expect(document.author).toBeNull();
  });

  it.each<[string, Fixture, string]>([
    ["a file that is not a PDF", NOT_A_PDF, "not_a_pdf"],
    ["a password-protected PDF", ENCRYPTED, "encrypted_pdf"],
    ["a PDF with no text layer", IMAGE_ONLY, "no_text_layer"],
  ])("rejects %s with 422 and adds nothing", async (_, fixture, code) => {
    const t = app.get();

    const res = await importFixture(t, fixture);

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: code, message: expect.any(String) });
    expect(await (await t.request("/api/documents")).json()).toEqual([]);
    expect((await t.request(`/api/documents/${await fixtureId(fixture)}`)).status).toBe(404);
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
