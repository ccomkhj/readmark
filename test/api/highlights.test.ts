import { describe, expect, it } from "vitest";
import { SAMPLE, type PdfFixture } from "../fixtures/definitions.ts";
import { fixtureId, importFixture, useTestApp, type TestApp } from "./harness.ts";

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
