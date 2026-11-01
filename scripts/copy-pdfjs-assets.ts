/**
 * Copies PDF.js runtime assets (cmaps, standard fonts, wasm decoders, ICC
 * profiles) from node_modules into src/client/public/pdfjs/ so the browser
 * loads them from our own origin: the app makes no CDN/network calls. The
 * worker is bundled by Vite instead (see src/client/pdf/pdfjs.ts).
 * Runs automatically before `dev` and `build`; output is gitignored.
 */
import { cpSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSET_DIRS = ["cmaps", "standard_fonts", "wasm", "iccs"];

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "client", "public", "pdfjs");

rmSync(target, { recursive: true, force: true });
for (const dir of ASSET_DIRS) {
  cpSync(join(pdfjsRoot, dir), join(target, dir), { recursive: true });
}
console.log(`copied PDF.js assets (${ASSET_DIRS.join(", ")}) to src/client/public/pdfjs/`);
