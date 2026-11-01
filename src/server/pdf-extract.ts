/**
 * Node-side PDF.js: parse PDF bytes into metadata plus canonical page text.
 * Uses the legacy build (the modern build targets browsers). PDF.js runs its
 * "worker" in-process in Node, so no worker setup is needed here.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { canonicalPageText } from "../shared/page-text.ts";
import { DomainError } from "./domain-error.ts";

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
// Local asset dirs (trailing slash required). Never fetched from the network.
const STANDARD_FONT_DATA_URL = join(pdfjsRoot, "standard_fonts") + "/";
const CMAP_URL = join(pdfjsRoot, "cmaps") + "/";

export type ExtractedPdf = {
  title: string | null;
  author: string | null;
  /** Canonical page text, index 0 = page 1. */
  pages: string[];
};

/**
 * Throws `not_a_pdf` if PDF.js cannot parse the bytes, `encrypted_pdf` if the
 * PDF needs a password to open.
 */
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  const task = getDocument({
    // PDF.js may transfer/detach the buffer it is given; pass a copy.
    data: bytes.slice(),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    verbosity: 0,
  });
  const pdf = await task.promise.catch(async (err: unknown) => {
    await task.destroy();
    throw toDomainError(err);
  });
  try {
    const { info } = (await pdf.getMetadata()) as { info: Record<string, unknown> };
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(canonicalPageText(content.items));
      page.cleanup();
    }
    return { title: nonEmpty(info.Title), author: nonEmpty(info.Author), pages };
  } finally {
    await task.destroy();
  }
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** PDF.js load failures -> stable error codes. Anything unexpected is rethrown (500). */
function toDomainError(err: unknown): unknown {
  const name = err instanceof Error ? err.name : undefined;
  if (name === "PasswordException") {
    return new DomainError("encrypted_pdf", "This PDF is password-protected. Remove the password and import it again.");
  }
  if (name === "InvalidPDFException" || name === "FormatError") {
    return new DomainError("not_a_pdf", "This file isn't a valid PDF.");
  }
  return err;
}
