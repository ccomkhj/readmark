/**
 * Deterministically renders the fixtures in test/fixtures/definitions.ts to
 * test/fixtures/*.pdf. Same definitions in, same bytes out (fixed dates, fixed
 * producer, no random document ID), so Document ids in tests are stable.
 *
 *   npm run fixtures
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FIXTURES, type Fixture, type PdfFixture } from "../test/fixtures/definitions.ts";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
const FIXED_DATE = new Date("2020-01-01T00:00:00Z");
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter, points
const MARGIN = 72;
const FONT_SIZE = 14;
const LINE_HEIGHT = 24;

async function renderPdf(fixture: PdfFixture): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setProducer("book-reader fixtures");
  pdf.setCreator("book-reader fixtures");
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  if (fixture.metadata.title !== undefined) pdf.setTitle(fixture.metadata.title);
  if (fixture.metadata.author !== undefined) pdf.setAuthor(fixture.metadata.author);

  for (const spec of fixture.pages) {
    const page = pdf.addPage(PAGE_SIZE);
    const top = PAGE_SIZE[1] - MARGIN;
    if (spec.kind === "text") {
      spec.lines.forEach((line, i) => {
        page.drawText(line, { x: MARGIN, y: top - i * LINE_HEIGHT, size: FONT_SIZE, font });
      });
    } else {
      page.drawRectangle({ x: MARGIN, y: top - 300, width: 300, height: 300, color: rgb(0.2, 0.4, 0.8) });
      page.drawEllipse({ x: MARGIN + 300, y: top - 150, xScale: 80, yScale: 80, color: rgb(0.9, 0.5, 0.1) });
    }
  }
  return pdf.save({ useObjectStreams: false });
}

export async function renderFixture(fixture: Fixture): Promise<Uint8Array> {
  switch (fixture.kind) {
    case "pdf":
      return renderPdf(fixture);
  }
}

async function main() {
  for (const fixture of FIXTURES) {
    const bytes = await renderFixture(fixture);
    await writeFile(join(FIXTURE_DIR, fixture.fileName), bytes);
    console.log(`wrote test/fixtures/${fixture.fileName} (${bytes.length} bytes)`);
  }
}

await main();
