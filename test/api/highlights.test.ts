import { describe, expect, it } from "vitest";
import { SAMPLE, SECOND, type PdfFixture } from "../fixtures/definitions.ts";
import { createTestApp, fixtureId, importFixture, useTestApp, type TestApp } from "./harness.ts";

const app = useTestApp();

type Anchor = { page: number; offset: number };

/** Canonical page text of a fixture page (1-based), per the fixture definition. */
function pageText(fixture: PdfFixture, page: number): string {
  const p = fixture.pages[page - 1]!;
  return p.kind === "text" ? p.lines.join("\n") : "";
}

/** Anchors of the first occurrence of `text` on `page`. */
function rangeOf(fixture: PdfFixture, page: number, text: string): { start: Anchor; end: Anchor } {
  const offset = pageText(fixture, page).indexOf(text);
  if (offset < 0) throw new Error(`"${text}" not on page ${page}`);
  return { start: { page, offset }, end: { page, offset: offset + text.length } };
}

async function importSample(t: TestApp): Promise<string> {
  await importFixture(t, SAMPLE);
  return fixtureId(SAMPLE);
}

function createHighlight(t: TestApp, documentId: string, body: unknown): Promise<Response> {
  return t.request(`/api/documents/${documentId}/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/documents/:id/highlights", () => {
  it("creates a Highlight with the exact quote of a single-line range", async () => {
    const t = app.get();
    const id = await importSample(t);
    const range = rangeOf(SAMPLE, 1, "a conversation with the author");

    const res = await createHighlight(t, id, range);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      documentId: id,
      start: range.start,
      end: range.end,
      quote: "a conversation with the author",
      note: null,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("joins lines with a single space when the range crosses a line break", async () => {
    const t = app.get();
    const id = await importSample(t);
    const start = rangeOf(SAMPLE, 1, "the passages that matter").start;
    const end = rangeOf(SAMPLE, 1, "and writes down").end;

    const res = await createHighlight(t, id, { start, end });

    expect(res.status).toBe(201);
    expect((await res.json()).quote).toBe("the passages that matter and writes down");
  });

  it("joins pages with a single space when the range crosses a page break", async () => {
    const t = app.get();
    const id = await importSample(t);
    const start = rangeOf(SAMPLE, 2, "This sentence begins").start;
    const end = rangeOf(SAMPLE, 3, "without a break.").end;

    const res = await createHighlight(t, id, { start, end });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      start,
      end,
      quote: "This sentence begins on page two and continues on page three without a break.",
    });
  });

  it("collapses whitespace runs and trims, including across an empty page", async () => {
    const t = app.get();
    const id = await importSample(t);
    // From the line break before "The next page" on page 3, over figure-only page 4,
    // to the line break after "Chapter Four" on page 5.
    const start = { page: 3, offset: rangeOf(SAMPLE, 3, "The next page").start.offset - 1 };
    const end = { page: 5, offset: "Chapter Four\n".length };

    const res = await createHighlight(t, id, { start, end });

    expect(res.status).toBe(201);
    expect((await res.json()).quote).toBe("The next page holds only a figure. Chapter Four");
  });

  it.each([
    ["page 0", { page: 0, offset: 0 }, { page: 1, offset: 5 }],
    ["page past the last page", { page: 5, offset: 0 }, { page: 6, offset: 1 }],
    ["negative offset", { page: 1, offset: -1 }, { page: 1, offset: 5 }],
    ["offset past the page text", { page: 1, offset: 0 }, { page: 1, offset: pageText(SAMPLE, 1).length + 1 }],
    ["non-integer offset", { page: 1, offset: 0.5 }, { page: 1, offset: 5 }],
    ["reversed on one page", { page: 1, offset: 10 }, { page: 1, offset: 5 }],
    ["reversed across pages", { page: 2, offset: 0 }, { page: 1, offset: 5 }],
    ["zero-length", { page: 1, offset: 5 }, { page: 1, offset: 5 }],
  ])("rejects an invalid range (%s) with 422 invalid_range", async (_, start, end) => {
    const t = app.get();
    const id = await importSample(t);

    const res = await createHighlight(t, id, { start, end });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "invalid_range", message: expect.any(String) });
  });

  it("accepts a range ending exactly at the end of the page text", async () => {
    const t = app.get();
    const id = await importSample(t);
    const text = pageText(SAMPLE, 5);

    const res = await createHighlight(t, id, { start: { page: 5, offset: 0 }, end: { page: 5, offset: text.length } });

    expect(res.status).toBe(201);
    expect((await res.json()).quote).toBe("Chapter Four After the figure, the text resumes.");
  });

  it("rejects a whitespace-only range with 422 empty_highlight", async () => {
    const t = app.get();
    const id = await importSample(t);
    const lineBreak = "Chapter One".length;

    const res = await createHighlight(t, id, {
      start: { page: 1, offset: lineBreak },
      end: { page: 1, offset: lineBreak + 1 },
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "empty_highlight", message: expect.any(String) });
  });

  it("rejects a range over only the figure-only page with 422 empty_highlight", async () => {
    const t = app.get();
    const id = await importSample(t);

    const res = await createHighlight(t, id, {
      start: { page: 3, offset: pageText(SAMPLE, 3).length },
      end: { page: 5, offset: 0 },
    });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("empty_highlight");
  });

  it("returns 404 document_not_found for an unknown Document", async () => {
    const res = await createHighlight(app.get(), "0".repeat(64), rangeOf(SAMPLE, 1, "Chapter One"));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("document_not_found");
  });

  it("returns 400 bad_request for a malformed body", async () => {
    const t = app.get();
    const id = await importSample(t);

    const res = await createHighlight(t, id, { start: { page: 1 } });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });
});

describe("overlap and reading order", () => {
  it("rejects a range sharing a character with an existing Highlight with 409 overlapping_highlight", async () => {
    const t = app.get();
    const id = await importSample(t);
    await createHighlight(t, id, rangeOf(SAMPLE, 1, "a conversation with"));

    for (const text of ["is a conversation", "with the author", "conversation", "Reading is a conversation with the"]) {
      const res = await createHighlight(t, id, rangeOf(SAMPLE, 1, text));
      expect(res.status, text).toBe(409);
      expect(await res.json()).toEqual({ error: "overlapping_highlight", message: expect.any(String) });
    }
  });

  it("detects overlap with a Highlight that crosses a page break", async () => {
    const t = app.get();
    const id = await importSample(t);
    await createHighlight(t, id, {
      start: rangeOf(SAMPLE, 2, "page two and").start,
      end: rangeOf(SAMPLE, 3, "continues").end,
    });

    const res = await createHighlight(t, id, rangeOf(SAMPLE, 3, "continues on page"));

    expect(res.status).toBe(409);
  });

  it("allows touching ranges (one ends where the other starts)", async () => {
    const t = app.get();
    const id = await importSample(t);
    const first = rangeOf(SAMPLE, 1, "Reading is ");
    await createHighlight(t, id, first);

    const res = await createHighlight(t, id, { start: first.end, end: rangeOf(SAMPLE, 1, "a conversation").end });

    expect(res.status).toBe(201);
  });

  it("lists Highlights by start anchor regardless of creation order", async () => {
    const t = app.get();
    const id = await importSample(t);
    for (const [page, text] of [
      [3, "Chapter Three"],
      [1, "the author"],
      [2, "active thinking"],
      [1, "Chapter One"],
    ] as const) {
      expect((await createHighlight(t, id, rangeOf(SAMPLE, page, text))).status).toBe(201);
    }

    const res = await t.request(`/api/documents/${id}/highlights`);

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.map((h: { quote: string }) => h.quote)).toEqual([
      "Chapter One",
      "the author",
      "active thinking",
      "Chapter Three",
    ]);
  });

  it("lists nothing for a Document without Highlights, and 404 for an unknown Document", async () => {
    const t = app.get();
    const id = await importSample(t);

    expect(await (await t.request(`/api/documents/${id}/highlights`)).json()).toEqual([]);
    const unknown = await t.request(`/api/documents/${"0".repeat(64)}/highlights`);
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error).toBe("document_not_found");
  });
});

const UNKNOWN_HIGHLIGHT = "00000000-0000-0000-0000-000000000000";

/** Imports SAMPLE and creates one Highlight on "Chapter One"; returns its JSON. */
async function sampleWithHighlight(t: TestApp) {
  const id = await importSample(t);
  const res = await createHighlight(t, id, rangeOf(SAMPLE, 1, "Chapter One"));
  return { documentId: id, highlight: await res.json() };
}

function putNote(t: TestApp, highlightId: string, body: unknown): Promise<Response> {
  return t.request(`/api/highlights/${highlightId}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listQuotesAndNotes(t: TestApp, documentId: string) {
  const list = await (await t.request(`/api/documents/${documentId}/highlights`)).json();
  return list.map((h: { quote: string; note: { text: string } | null }) => [h.quote, h.note?.text ?? null]);
}

describe("DELETE /api/highlights/:id", () => {
  it("removes the Highlight and its Note", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await createHighlight(t, documentId, rangeOf(SAMPLE, 1, "the author"));
    await putNote(t, highlight.id, { text: "why this matters" });

    const res = await t.request(`/api/highlights/${highlight.id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await listQuotesAndNotes(t, documentId)).toEqual([["the author", null]]);
    // Its Note is gone with it.
    expect((await putNote(t, highlight.id, { text: "again" })).status).toBe(404);
  });

  it("returns 404 highlight_not_found for an unknown Highlight", async () => {
    const res = await app.get().request(`/api/highlights/${UNKNOWN_HIGHLIGHT}`, { method: "DELETE" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "highlight_not_found", message: expect.any(String) });
  });

  it("frees the range for a new Highlight", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await t.request(`/api/highlights/${highlight.id}`, { method: "DELETE" });

    expect((await createHighlight(t, documentId, rangeOf(SAMPLE, 1, "Chapter"))).status).toBe(201);
  });
});

describe("Notes", () => {
  it("PUT creates a Note, stored verbatim with multi-line Markdown", async () => {
    const t = app.get();
    const { highlight } = await sampleWithHighlight(t);
    const text = "  **Key idea**\n\n- reading is dialogue\n- mark what matters  \n";

    const res = await putNote(t, highlight.id, { text });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...highlight,
      note: { text, updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
  });

  it("PUT replaces an existing Note", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await putNote(t, highlight.id, { text: "first thought" });

    const res = await putNote(t, highlight.id, { text: "second thought" });

    expect(res.status).toBe(200);
    expect((await res.json()).note.text).toBe("second thought");
    expect(await listQuotesAndNotes(t, documentId)).toEqual([["Chapter One", "second thought"]]);
  });

  it("PUT with whitespace-only text removes the Note", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await putNote(t, highlight.id, { text: "a thought" });

    const res = await putNote(t, highlight.id, { text: " \n\t " });

    expect(res.status).toBe(200);
    expect((await res.json()).note).toBeNull();
    expect(await listQuotesAndNotes(t, documentId)).toEqual([["Chapter One", null]]);
  });

  it("DELETE removes the Note and returns the Highlight", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await putNote(t, highlight.id, { text: "a thought" });

    const res = await t.request(`/api/highlights/${highlight.id}/note`, { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...highlight, note: null });
    expect(await listQuotesAndNotes(t, documentId)).toEqual([["Chapter One", null]]);
  });

  it("returns 404 highlight_not_found for an unknown Highlight", async () => {
    const t = app.get();

    const put = await putNote(t, UNKNOWN_HIGHLIGHT, { text: "x" });
    const del = await t.request(`/api/highlights/${UNKNOWN_HIGHLIGHT}/note`, { method: "DELETE" });

    expect([put.status, del.status]).toEqual([404, 404]);
    expect((await put.json()).error).toBe("highlight_not_found");
    expect((await del.json()).error).toBe("highlight_not_found");
  });

  it("PUT returns 400 bad_request without a string `text`", async () => {
    const t = app.get();
    const { highlight } = await sampleWithHighlight(t);

    const res = await putNote(t, highlight.id, { text: 42 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });
});

describe("Highlights in the Library", () => {
  it("highlightCount in list and get reflects the current number of Highlights", async () => {
    const t = app.get();
    const id = await importSample(t);
    await importFixture(t, SECOND);
    const secondId = await fixtureId(SECOND);
    const counts = async () => {
      const list = await (await t.request("/api/documents")).json();
      const get = await (await t.request(`/api/documents/${id}`)).json();
      return {
        list: Object.fromEntries(list.map((d: { id: string; highlightCount: number }) => [d.id, d.highlightCount])),
        get: get.highlightCount,
      };
    };

    const first = await (await createHighlight(t, id, rangeOf(SAMPLE, 1, "Chapter One"))).json();
    await createHighlight(t, id, rangeOf(SAMPLE, 2, "Chapter Two"));
    expect(await counts()).toEqual({ list: { [id]: 2, [secondId]: 0 }, get: 2 });

    await t.request(`/api/highlights/${first.id}`, { method: "DELETE" });
    expect(await counts()).toEqual({ list: { [id]: 1, [secondId]: 0 }, get: 1 });
  });

  it("removing a Document removes its Highlights; re-importing gives a fresh Document without them", async () => {
    const t = app.get();
    const { documentId, highlight } = await sampleWithHighlight(t);
    await putNote(t, highlight.id, { text: "a thought" });

    await t.request(`/api/documents/${documentId}`, { method: "DELETE" });
    expect((await putNote(t, highlight.id, { text: "x" })).status).toBe(404);
    const reimport = await (await importFixture(t, SAMPLE)).json();

    expect(reimport).toMatchObject({ created: true, document: { id: documentId, highlightCount: 0 } });
    expect(await (await t.request(`/api/documents/${documentId}/highlights`)).json()).toEqual([]);
    // The old range is free again.
    expect((await createHighlight(t, documentId, rangeOf(SAMPLE, 1, "Chapter One"))).status).toBe(201);
  });

  it("a new app instance on the same data directory returns the same Highlights and Notes", async () => {
    const first = app.get();
    const id = await importSample(first);
    const crossPage = await (
      await createHighlight(first, id, {
        start: rangeOf(SAMPLE, 2, "This sentence").start,
        end: rangeOf(SAMPLE, 3, "without a break.").end,
      })
    ).json();
    await createHighlight(first, id, rangeOf(SAMPLE, 1, "Chapter One"));
    await putNote(first, crossPage.id, { text: "line one\n\n> line two" });
    const before = await (await first.request(`/api/documents/${id}/highlights`)).json();
    first.stop();

    const second = await createTestApp(first.dataDir);
    try {
      const after = await (await second.request(`/api/documents/${id}/highlights`)).json();
      expect(after).toEqual(before);
      expect(await listQuotesAndNotes(second, id)).toEqual([
        ["Chapter One", null],
        ["This sentence begins on page two and continues on page three without a break.", "line one\n\n> line two"],
      ]);
      expect((await (await second.request(`/api/documents/${id}`)).json()).highlightCount).toBe(2);
    } finally {
      second.stop();
    }
  });
});
