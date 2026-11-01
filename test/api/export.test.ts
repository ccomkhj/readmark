import { describe, expect, it } from "vitest";
import { NO_METADATA, SAMPLE, type PdfFixture } from "../fixtures/definitions.ts";
import { fixtureId, importFixture, useTestApp, type TestApp } from "./harness.ts";

const app = useTestApp();

type Anchor = { page: number; offset: number };

/** Anchor just before (`at: "start"`) or after (`at: "end"`) the first `text` on `page`. */
function anchorAt(fixture: PdfFixture, page: number, text: string, at: "start" | "end"): Anchor {
  const p = fixture.pages[page - 1]!;
  const offset = (p.kind === "text" ? p.lines.join("\n") : "").indexOf(text);
  if (offset < 0) throw new Error(`"${text}" not on page ${page}`);
  return { page, offset: at === "start" ? offset : offset + text.length };
}

/** Creates a Highlight from `startText` (on `startPage`) to `endText` (on `endPage`); returns its id. */
async function highlight(
  t: TestApp,
  documentId: string,
  [startPage, startText]: [number, string],
  [endPage, endText]: [number, string],
): Promise<string> {
  const res = await t.request(`/api/documents/${documentId}/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: anchorAt(SAMPLE, startPage, startText, "start"),
      end: anchorAt(SAMPLE, endPage, endText, "end"),
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function putNote(t: TestApp, highlightId: string, text: string): Promise<void> {
  const res = await t.request(`/api/highlights/${highlightId}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  expect(res.status).toBe(200);
}

describe("GET /api/documents/:id/export", () => {
  it("exports a Document with zero Highlights", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);
    const id = await fixtureId(SAMPLE);

    const res = await t.request(`/api/documents/${id}/export`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="the-art-of-reading-insights.md"');
    expect(await res.text()).toBe(
      "# The Art of Reading\n" +
        "\n" +
        "Author: Ada Lovelace\n" +
        "\n" +
        "These are a reader's Highlights and Notes from this document, in reading order.\n" +
        "\n" +
        "*No highlights yet.*\n",
    );
  });

  it("exports mixed Highlights in reading order with page references and verbatim Notes", async () => {
    const t = app.get();
    await importFixture(t, SAMPLE);
    const id = await fixtureId(SAMPLE);
    // Created out of reading order on purpose.
    const crossPage = await highlight(t, id, [2, "This sentence begins"], [3, "without a break."]);
    await highlight(t, id, [5, "the text resumes."], [5, "the text resumes."]);
    const multiLine = await highlight(t, id, [1, "A good reader"], [1, "they provoke."]);
    await highlight(t, id, [1, "a conversation with the author"], [1, "a conversation with the author"]);
    await putNote(t, multiLine, "Two ideas here:\n\n- *marking* passages\n- writing thoughts down");
    await putNote(t, crossPage, "Crosses a page break.");

    const res = await t.request(`/api/documents/${id}/export`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(
      "# The Art of Reading\n" +
        "\n" +
        "Author: Ada Lovelace\n" +
        "\n" +
        "These are a reader's Highlights and Notes from this document, in reading order.\n" +
        "\n" +
        "**p. 1**\n" +
        "\n" +
        "> a conversation with the author\n" +
        "\n" +
        "---\n" +
        "\n" +
        "**p. 1**\n" +
        "\n" +
        "> A good reader marks the passages that matter and writes down the thoughts they provoke.\n" +
        "\n" +
        "**Note:** Two ideas here:\n" +
        "\n" +
        "- *marking* passages\n" +
        "- writing thoughts down\n" +
        "\n" +
        "---\n" +
        "\n" +
        "**pp. 2–3**\n" +
        "\n" +
        "> This sentence begins on page two and continues on page three without a break.\n" +
        "\n" +
        "**Note:** Crosses a page break.\n" +
        "\n" +
        "---\n" +
        "\n" +
        "**p. 5**\n" +
        "\n" +
        "> the text resumes.\n",
    );
  });

  it("omits the Author line for a Document with no author", async () => {
    const t = app.get();
    await importFixture(t, NO_METADATA);
    const id = await fixtureId(NO_METADATA);

    const res = await t.request(`/api/documents/${id}/export`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="untitled-notes-insights.md"');
    expect(await res.text()).toBe(
      "# untitled-notes\n" +
        "\n" +
        "These are a reader's Highlights and Notes from this document, in reading order.\n" +
        "\n" +
        "*No highlights yet.*\n",
    );
  });

  it("returns 404 document_not_found for an unknown Document", async () => {
    const t = app.get();

    const res = await t.request(`/api/documents/${"0".repeat(64)}/export`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "document_not_found", message: expect.any(String) });
  });
});
