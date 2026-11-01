/**
 * Highlights & Notes (spec Module 3). A Highlight is a `[start, end)` range of
 * a Document's canonical page text plus its derived quote; its Note (0 or 1)
 * lives on the same row. Rows cascade-delete with their Document.
 */
import { randomUUID } from "node:crypto";
import type { HighlightDto } from "../shared/api-types.ts";
import {
  bodySegments,
  compareAnchors,
  deriveQuote,
  detectPageFurniture,
  isAnchorInBounds,
  type Anchor,
  type PageFurniture,
  type TextRange,
} from "../shared/page-text.ts";
import type { Db } from "./db.ts";
import { documentNotFound, DomainError } from "./domain-error.ts";

export type Highlights = {
  /**
   * Throws `document_not_found`, `invalid_range` (out of bounds, or start not
   * before end), `empty_highlight` (whitespace-only quote), `overlapping_highlight`.
   */
  create(documentId: string, start: Anchor, end: Anchor): HighlightDto;
  /** Reading order (by start anchor). Throws `document_not_found`. */
  list(documentId: string): HighlightDto[];
  /** Removes the Highlight and its Note. Throws `highlight_not_found`. */
  remove(id: string): void;
  /**
   * Creates or replaces the Note, stored verbatim; whitespace-only `text`
   * removes it. Throws `highlight_not_found`.
   */
  putNote(id: string, text: string): HighlightDto;
  /** Throws `highlight_not_found`. */
  removeNote(id: string): HighlightDto;
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
    if (!exists) throw documentNotFound(documentId);
  };

  /**
   * The Document's canonical page texts and page furniture. Furniture is
   * derived on read, never stored: page text is immutable per Document.
   */
  const documentText = (documentId: string): DocumentText => {
    const rows = db
      .prepare(`SELECT text FROM page_texts WHERE document_id = ? ORDER BY page`)
      .all(documentId) as { text: string }[];
    const pages = rows.map((r) => r.text);
    return { pages, furniture: detectPageFurniture(pages) };
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
    const text = documentText(documentId);
    const { pages, furniture } = text;
    if (!isAnchorInBounds(pages, start) || !isAnchorInBounds(pages, end)) {
      throw new DomainError("invalid_range", "Anchor out of bounds of the Document's page text.");
    }
    if (compareAnchors(start, end) >= 0) {
      throw new DomainError("invalid_range", "Start must come before end in reading order.");
    }
    const quote = deriveQuote(pages, start, end, furniture);
    if (quote === "") {
      throw new DomainError("empty_highlight", "The range contains only whitespace or page furniture.");
    }
    // [start, end) ranges share a character iff each starts before the other ends.
    // Whole ranges, furniture included: anchors are what is stored.
    const overlaps = listRows(documentId)
      .map(rowRange)
      .some((h) => compareAnchors(start, h.end) < 0 && compareAnchors(h.start, end) < 0);
    if (overlaps) throw new DomainError("overlapping_highlight", "The range overlaps an existing Highlight.");

    const id = randomUUID();
    insert.run(id, documentId, start.page, start.offset, end.page, end.offset, quote, new Date().toISOString());
    return toDto(find(id)!, text);
  });

  return {
    create: (documentId, start, end) => create(documentId, start, end),

    list(documentId) {
      requireDocument(documentId);
      const text = documentText(documentId);
      return listRows(documentId).map((row) => toDto(row, text));
    },

    remove(id) {
      const { changes } = db.prepare(`DELETE FROM highlights WHERE id = ?`).run(id);
      if (changes === 0) throw notFound(id);
    },

    putNote(id, text) {
      if (text.trim() === "") return setNote(id, null);
      return setNote(id, { text, updatedAt: new Date().toISOString() });
    },

    removeNote: (id) => setNote(id, null),
  };

  function setNote(id: string, note: { text: string; updatedAt: string } | null): HighlightDto {
    const { changes } = db
      .prepare(`UPDATE highlights SET note_text = ?, note_updated_at = ? WHERE id = ?`)
      .run(note?.text ?? null, note?.updatedAt ?? null, id);
    if (changes === 0) throw notFound(id);
    const row = find(id)!;
    return toDto(row, documentText(row.document_id));
  }
}

function notFound(id: string): DomainError {
  return new DomainError("highlight_not_found", `No Highlight with id ${id}`);
}

type DocumentText = { pages: string[]; furniture: PageFurniture };

function rowRange(row: HighlightRow): TextRange {
  return { start: { page: row.start_page, offset: row.start_offset }, end: { page: row.end_page, offset: row.end_offset } };
}

function toDto(row: HighlightRow, { pages, furniture }: DocumentText): HighlightDto {
  const { start, end } = rowRange(row);
  return {
    id: row.id,
    documentId: row.document_id,
    start,
    end,
    segments: bodySegments(pages, start, end, furniture),
    quote: row.quote,
    note: row.note_text === null ? null : { text: row.note_text, updatedAt: row.note_updated_at! },
    createdAt: row.created_at,
  };
}
