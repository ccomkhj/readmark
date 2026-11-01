/**
 * Deterministically renders the fixtures in test/fixtures/definitions.ts to
 * test/fixtures/*.pdf. Same definitions in, same bytes out (fixed dates, fixed
 * producer, no random document ID), so Document ids in tests are stable.
 *
 *   npm run fixtures
 */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  FIXTURES,
  type EncryptedPdfFixture,
  type Fixture,
  type PdfFixture,
} from "../test/fixtures/definitions.ts";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
const FIXED_DATE = new Date("2020-01-01T00:00:00Z");
const PAGE_SIZE: [number, number] = [612, 792]; // US Letter, points
const MARGIN = 72;
const FONT_SIZE = 14;
const LINE_HEIGHT = 24;

async function renderPdf(fixture: PdfFixture): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setProducer("readmark fixtures");
  pdf.setCreator("readmark fixtures");
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  if (fixture.metadata.title !== undefined) pdf.setTitle(fixture.metadata.title);
  if (fixture.metadata.author !== undefined) pdf.setAuthor(fixture.metadata.author);

  const image = fixture.pages.some((p) => p.kind === "image") ? await pdf.embedPng(gradientPng(64, 64)) : null;

  for (const spec of fixture.pages) {
    const page = pdf.addPage(PAGE_SIZE);
    const top = PAGE_SIZE[1] - MARGIN;
    if (spec.kind === "text") {
      spec.lines.forEach((line, i) => {
        page.drawText(line, { x: MARGIN, y: top - i * LINE_HEIGHT, size: FONT_SIZE, font });
      });
    } else if (spec.kind === "image") {
      page.drawImage(image!, { x: MARGIN, y: top - 400, width: 400, height: 400 });
    } else {
      page.drawRectangle({ x: MARGIN, y: top - 300, width: 300, height: 300, color: rgb(0.2, 0.4, 0.8) });
      page.drawEllipse({ x: MARGIN + 300, y: top - 150, xScale: 80, yScale: 80, color: rgb(0.9, 0.5, 0.1) });
    }
  }
  return pdf.save({ useObjectStreams: false });
}

/** Grayscale diagonal-gradient PNG, built by hand so the bytes are fixed. */
function gradientPng(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    typeAndData.copy(out, 4);
    out.writeUInt32BE(crc32(typeAndData), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit grayscale, no interlace
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = ((x + y) * 255) / (width + height - 2);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Encrypted PDF: Standard Security Handler, V1/R2 (RC4, 40-bit key) ---
// PDF 1.7 spec (ISO 32000-1) 7.6.3, Algorithms 1-4.

const PASSWORD_PAD = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

function padPassword(password: string): Buffer {
  return Buffer.concat([Buffer.from(password, "latin1"), PASSWORD_PAD]).subarray(0, 32);
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[n] = data[n]! ^ s[(s[i]! + s[j]!) & 255]!;
  }
  return out;
}

function escapePdfString(text: string): string {
  return text.replace(/[\\()]/g, (c) => `\\${c}`);
}

function renderEncryptedPdf(fixture: EncryptedPdfFixture): Uint8Array {
  const permissions = -4; // all permissions
  const fileId = md5(Buffer.from(fixture.fileName, "latin1")); // fixed, not random
  const o = rc4(md5(padPassword(fixture.ownerPassword)).subarray(0, 5), padPassword(fixture.userPassword));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const fileKey = md5(padPassword(fixture.userPassword), o, p, fileId).subarray(0, 5);
  const u = rc4(fileKey, PASSWORD_PAD);
  const objectKey = (num: number, gen: number) =>
    md5(fileKey, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255])).subarray(
      0,
      10,
    );

  const top = PAGE_SIZE[1] - MARGIN;
  const content = fixture.lines
    .map((line, i) => `BT /F1 ${FONT_SIZE} Tf ${MARGIN} ${top - i * LINE_HEIGHT} Td (${escapePdfString(line)}) Tj ET`)
    .join("\n");
  const stream = rc4(objectKey(4, 0), Buffer.from(content, "latin1"));

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_SIZE.join(" ")}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    ),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    Buffer.from(
      `<< /Filter /Standard /V 1 /R 2 /O <${o.toString("hex")}> /U <${u.toString("hex")}> /P ${permissions} >>`,
    ),
  ];

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  let offset = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    parts.push(obj);
    offset += obj.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${fileId.toString("hex")}> <${fileId.toString("hex")}>] >>`,
    "startxref",
    String(offset),
    "%%EOF",
    "",
  ].join("\n");
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

export async function renderFixture(fixture: Fixture): Promise<Uint8Array> {
  switch (fixture.kind) {
    case "pdf":
      return renderPdf(fixture);
    case "encrypted-pdf":
      return renderEncryptedPdf(fixture);
    case "raw":
      return Buffer.from(fixture.content, "utf8");
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
