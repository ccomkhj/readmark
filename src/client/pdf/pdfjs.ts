/**
 * Browser-side PDF.js setup. Import PDF.js through this module only, so the
 * worker and assets always come from our own origin (offline; no CDN):
 * - the worker is bundled by Vite (`?url` import),
 * - cmaps / standard fonts / wasm / ICC profiles are copied to /pdfjs/ by
 *   scripts/copy-pdfjs-assets.ts.
 * The pdfjs-dist version is pinned exactly in package.json and shared with the
 * server (src/server/pdf-extract.ts): canonical page text depends on it.
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// Text layer styles (`.textLayer`, `.endOfContent`) matching this PDF.js version.
import "pdfjs-dist/web/pdf_viewer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;

export { pdfjs };

export function loadPdf(url: string): Promise<pdfjs.PDFDocumentProxy> {
  return pdfjs.getDocument({
    url,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  }).promise;
}
