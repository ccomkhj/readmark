/**
 * Library (spec Module 2): import, list, get, file bytes, and remove Documents.
 * A Document's id is the SHA-256 hex of its bytes (ADR-0001). PDF bytes live
 * as files under `<dataDir>/library/<id>.pdf`; everything else in SQLite.
 */
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentDto, ImportResultDto } from "../shared/api-types.ts";
import type { Db } from "./db.ts";
import { DomainError } from "./domain-error.ts";
import { extractPdf } from "./pdf-extract.ts";


export type Library = {
  importPdf(bytes: Uint8Array, originalFilename: string): Promise<ImportResultDto>;
  /** Newest import first. */
  list(): DocumentDto[];
  /** Throws `document_not_found`. */
  get(id: string): DocumentDto;
  /** Original PDF bytes. Throws `document_not_found`. */
  fileBytes(id: string): Promise<Uint8Array<ArrayBuffer>>;
  /**
   * Removes the Document, its page texts and Highlights (schema cascade), and
   * its stored PDF bytes. Throws `document_not_found`.
   */
  remove(id: string): Promise<void>;
};

type DocumentRow = {
  id: string;
  title: string;
  author: string | null;
  page_count: number;
  imported_at: string;
  highlight_count: number;
};

const SELECT_DOCUMENT = `
  SELECT d.id, d.title, d.author, d.page_count, d.imported_at,
         (SELECT COUNT(*) FROM highlights h WHERE h.document_id = d.id) AS highlight_count
  FROM documents d`;

export function createLibrary(db: Db, dataDir: string): Library {
  const filesDir = join(dataDir, "library");
  mkdirSync(filesDir, { recursive: true });
  const filePath = (id: string) => join(filesDir, `${id}.pdf`);

  const findRow = (id: string) =>
    db.prepare(`${SELECT_DOCUMENT} WHERE d.id = ?`).get(id) as DocumentRow | undefined;

  const get = (id: string): DocumentDto => {
    const row = findRow(id);
    if (!row) throw new DomainError("document_not_found", `No Document with id ${id}`);
    return toDto(row);
  };

  const insertDocument = db.prepare(
    `INSERT INTO documents (id, title, author, original_filename, page_count, imported_at)
     VALUES (@id, @title, @author, @originalFilename, @pageCount, @importedAt)`,
  );
  const insertPageText = db.prepare(`INSERT INTO page_texts (document_id, page, text) VALUES (?, ?, ?)`);

  return {
    async importPdf(bytes, originalFilename) {
      const id = createHash("sha256").update(bytes).digest("hex");
      const extracted = await extractPdf(bytes);

      // Write bytes first (atomically), then the rows, so a stored Document
      // always has its file.
      const tmp = `${filePath(id)}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, filePath(id));

      db.transaction(() => {
        insertDocument.run({
          id,
          title: extracted.title ?? stripExtension(originalFilename),
          author: extracted.author,
          originalFilename,
          pageCount: extracted.pages.length,
          importedAt: new Date().toISOString(),
        });
        extracted.pages.forEach((text, i) => insertPageText.run(id, i + 1, text));
      })();

      return { document: get(id), created: true };
    },

    list() {
      // rowid breaks ties between imports within the same millisecond.
      const rows = db.prepare(`${SELECT_DOCUMENT} ORDER BY d.imported_at DESC, d.rowid DESC`).all() as DocumentRow[];
      return rows.map(toDto);
    },

    get,

    async fileBytes(id) {
      get(id);
      return new Uint8Array(await readFile(filePath(id)));
    },

    async remove(id) {
      // Rows first, then bytes (mirror of import), so a stored Document always
      // has its file; a crash in between only leaves an orphan file.
      const { changes } = db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
      if (changes === 0) throw new DomainError("document_not_found", `No Document with id ${id}`);
      await rm(filePath(id), { force: true });
    },
  };
}

function toDto(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    pageCount: row.page_count,
    importedAt: row.imported_at,
    highlightCount: row.highlight_count,
  };
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}
