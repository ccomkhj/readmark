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
  /**
   * Throws `document_not_found`, `invalid_range` (out of bounds, or start not
   * before end), `empty_highlight` (whitespace-only quote), `overlapping_highlight`.
   */
  create(documentId: string, start: Anchor, end: Anchor): HighlightDto;
  /** Reading order (by start anchor). Throws `document_not_found`. */
  list(documentId: string): HighlightDto[];
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
  const requireDocument = (documentId: string): void => {
    const exists = db.prepare(`SELECT 1 FROM documents WHERE id = ?`).get(documentId);
    if (!exists) throw new DomainError("document_not_found", `No Document with id ${documentId}`);
  };

  const pageTexts = (documentId: string): string[] => {
    const rows = db
      .prepare(`SELECT text FROM page_texts WHERE document_id = ? ORDER BY page`)
      .all(documentId) as { text: string }[];
    return rows.map((r) => r.text);
  };

  const find = (id: string) => db.prepare(`SELECT * FROM highlights WHERE id = ?`).get(id) as HighlightRow | undefined;

  /** A Document's Highlights in reading order. */
  const listRows = (documentId: string) =>
    db
      .prepare(`SELECT * FROM highlights WHERE document_id = ? ORDER BY start_page, start_offset`)
      .all(documentId) as HighlightRow[];

  const insert = db.prepare(
    `INSERT INTO highlights (id, document_id, start_page, start_offset, end_page, end_offset, quote, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // One transaction so the overlap check and the insert see the same rows.
  const create = db.transaction((documentId: string, start: Anchor, end: Anchor): HighlightDto => {
    requireDocument(documentId);
    const pages = pageTexts(documentId);
    if (!isAnchorInBounds(pages, start) || !isAnchorInBounds(pages, end)) {
      throw new DomainError("invalid_range", "Anchor out of bounds of the Document's page text.");
    }
    if (compareAnchors(start, end) >= 0) {
      throw new DomainError("invalid_range", "Start must come before end in reading order.");
    }
    const quote = deriveQuote(pages, start, end);
    if (quote === "") throw new DomainError("empty_highlight", "The range contains only whitespace.");
    // [start, end) ranges share a character iff each starts before the other ends.
    const overlaps = listRows(documentId)
      .map(toDto)
      .some((h) => compareAnchors(start, h.end) < 0 && compareAnchors(h.start, end) < 0);
    if (overlaps) throw new DomainError("overlapping_highlight", "The range overlaps an existing Highlight.");

    const id = randomUUID();
    insert.run(id, documentId, start.page, start.offset, end.page, end.offset, quote, new Date().toISOString());
    return toDto(find(id)!);
  });

  return {
    create: (documentId, start, end) => create(documentId, start, end),

    list(documentId) {
      requireDocument(documentId);
      return listRows(documentId).map(toDto);
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
