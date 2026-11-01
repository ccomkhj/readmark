/**
 * Node-side PDF.js: parse PDF bytes into metadata plus canonical page text.
 * Uses the legacy build (the modern build targets browsers). PDF.js runs its
 * "worker" in-process in Node, so no worker setup is needed here.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { canonicalPageText } from "../shared/page-text.ts";

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

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPdf> {
  const task = getDocument({
    // PDF.js may transfer/detach the buffer it is given; pass a copy.
    data: bytes.slice(),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    verbosity: 0,
  });
  const pdf = await task.promise;
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
