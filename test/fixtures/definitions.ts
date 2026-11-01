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
/** A page with only a raster image and no text (like a scanned page). */
export type ImagePage = { kind: "image" };
export type FixturePage = TextPage | FigurePage | ImagePage;

export type PdfFixture = {
  kind: "pdf";
  /** File name under test/fixtures/. */
  fileName: string;
  /** PDF Info dictionary metadata; omit a field to leave it absent. */
  metadata: { title?: string; author?: string };
  pages: FixturePage[];
};

/**
 * A text PDF protected by the Standard Security Handler (RC4 40-bit, R2) with
 * a non-empty user password, so it cannot be opened without the password.
 * Hand-written by the fixture script (pdf-lib cannot encrypt).
 */
export type EncryptedPdfFixture = {
  kind: "encrypted-pdf";
  fileName: string;
  userPassword: string;
  ownerPassword: string;
  lines: string[];
};

/** A file that is not a PDF at all, written verbatim. */
export type RawFixture = { kind: "raw"; fileName: string; content: string };

export type Fixture = PdfFixture | EncryptedPdfFixture | RawFixture;

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

/** A text PDF with no Info metadata: title falls back to the filename, author is null. */
export const NO_METADATA: PdfFixture = {
  kind: "pdf",
  fileName: "untitled-notes.pdf",
  metadata: {},
  pages: [{ kind: "text", lines: ["A document without a title or an author."] }],
};

/** A PDF whose only content is a raster image: no text layer anywhere. */
export const IMAGE_ONLY: PdfFixture = {
  kind: "pdf",
  fileName: "scanned.pdf",
  metadata: { title: "A Scanned Book", author: "Nobody" },
  pages: [{ kind: "image" }, { kind: "image" }],
};

/** A password-protected PDF. */
export const ENCRYPTED: EncryptedPdfFixture = {
  kind: "encrypted-pdf",
  fileName: "encrypted.pdf",
  userPassword: "secret",
  ownerPassword: "owner-secret",
  lines: ["This text is behind a password."],
};

/** Plain text with a .pdf extension: not a PDF. */
export const NOT_A_PDF: RawFixture = {
  kind: "raw",
  fileName: "not-a-pdf.pdf",
  content: "These are plain-text notes, not a PDF.\n",
};

export const FIXTURES: Fixture[] = [SAMPLE, SECOND, NO_METADATA, IMAGE_ONLY, ENCRYPTED, NOT_A_PDF];
