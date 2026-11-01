/**
 * Fixture PDF definitions: the single source of truth for what each fixture
 * contains. `scripts/make-fixtures.ts` renders these to `test/fixtures/*.pdf`;
 * tests import the same definitions to compute expected titles, page counts,
 * and anchors. To add a fixture: add an entry to `FIXTURES`, run
 * `npm run fixtures`, commit the generated file.
 */

/** One line of text drawn at the left margin, top to bottom. */
export type TextPage = { kind: "text"; lines: string[] };
/** A page with only vector shapes and no text (a "figure-only" page). */
export type FigurePage = { kind: "figure" };
export type FixturePage = TextPage | FigurePage;

export type PdfFixture = {
  kind: "pdf";
  /** File name under test/fixtures/. */
  fileName: string;
  /** PDF Info dictionary metadata; omit a field to leave it absent. */
  metadata: { title?: string; author?: string };
  pages: FixturePage[];
};

export type Fixture = PdfFixture;

/**
 * Multi-page text PDF with title/author, a sentence that crosses the
 * page 2 -> page 3 break, and a figure-only page 4.
 */
export const SAMPLE: PdfFixture = {
  kind: "pdf",
  fileName: "sample.pdf",
  metadata: { title: "The Art of Reading", author: "Ada Lovelace" },
  pages: [
    {
      kind: "text",
      lines: [
        "Chapter One",
        "Reading is a conversation with the author.",
        "A good reader marks the passages that matter",
        "and writes down the thoughts they provoke.",
      ],
    },
    {
      kind: "text",
      lines: [
        "Chapter Two",
        "Notes turn passive reading into active thinking.",
        "This sentence begins on page two and",
      ],
    },
    {
      kind: "text",
      lines: [
        "continues on page three without a break.",
        "Chapter Three",
        "The next page holds only a figure.",
      ],
    },
    { kind: "figure" },
    {
      kind: "text",
      lines: ["Chapter Four", "After the figure, the text resumes."],
    },
  ],
};

/** A second, smaller Document, for tests that need two in the Library. */
export const SECOND: PdfFixture = {
  kind: "pdf",
  fileName: "second.pdf",
  metadata: { title: "A Second Book", author: "Grace Hopper" },
  pages: [
    {
      kind: "text",
      lines: ["Preface", "Every book in the Library has its own identity."],
    },
    { kind: "text", lines: ["The end."] },
  ],
};

export const FIXTURES: Fixture[] = [SAMPLE, SECOND];
