/**
 * Highlights & Notes (spec Module 3). A Highlight is a `[start, end)` range of
 * a Document's canonical page text plus its derived quote; its Note (0 or 1)
 * lives on the same row. Rows cascade-delete with their Document.
 */
import { randomUUID } from "node:crypto";
import type { HighlightDto } from "../shared/api-types.ts";
import { compareAnchors, deriveQuote, isAnchorInBounds, type Anchor } from "../shared/page-text.ts";
import type { Db } from "./db.ts";
import { DomainError } from "./domain-error.ts";

export type Highlights = {
  /** Throws `document_not_found`. */
  create(documentId: string, start: Anchor, end: Anchor): HighlightDto;
};

type HighlightRow = {
  id: string;
  document_id: string;
  start_page: number;
  start_offset: number;
  end_page: number;
  end_offset: number;
  quote: string;
  created_at: string;
  note_text: string | null;
  note_updated_at: string | null;
};

export function createHighlights(db: Db): Highlights {
  const pageTexts = (documentId: string): string[] => {
    const exists = db.prepare(`SELECT 1 FROM documents WHERE id = ?`).get(documentId);
    if (!exists) throw new DomainError("document_not_found", `No Document with id ${documentId}`);
    const rows = db
      .prepare(`SELECT text FROM page_texts WHERE document_id = ? ORDER BY page`)
      .all(documentId) as { text: string }[];
    return rows.map((r) => r.text);
  };

  const find = (id: string) => db.prepare(`SELECT * FROM highlights WHERE id = ?`).get(id) as HighlightRow | undefined;

  return {
    create(documentId, start, end) {
      const pages = pageTexts(documentId);
      if (!isAnchorInBounds(pages, start) || !isAnchorInBounds(pages, end)) {
        throw new DomainError("invalid_range", "Anchor out of bounds of the Document's page text.");
      }
      if (compareAnchors(start, end) >= 0) {
        throw new DomainError("invalid_range", "Start must come before end in reading order.");
      }
      const quote = deriveQuote(pages, start, end);
      if (quote === "") throw new DomainError("empty_highlight", "The range contains only whitespace.");
      const id = randomUUID();
      db.prepare(
        `INSERT INTO highlights (id, document_id, start_page, start_offset, end_page, end_offset, quote, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, documentId, start.page, start.offset, end.page, end.offset, quote, new Date().toISOString());
      return toDto(find(id)!);
    },
  };
}

function toDto(row: HighlightRow): HighlightDto {
  return {
    id: row.id,
    documentId: row.document_id,
    start: { page: row.start_page, offset: row.start_offset },
    end: { page: row.end_page, offset: row.end_offset },
    quote: row.quote,
    note: row.note_text === null ? null : { text: row.note_text, updatedAt: row.note_updated_at! },
    createdAt: row.created_at,
  };
}
