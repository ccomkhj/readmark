/**
 * SQLite connection and schema (spec: "Schema (SQLite)"). The full v1 schema,
 * including highlights, is created here so feature tickets don't race to
 * migrate it. Schema changes: append a new entry to MIGRATIONS, never edit one.
 */
import Database from "better-sqlite3";

export type Db = Database.Database;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    original_filename TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    imported_at TEXT NOT NULL
  );
  CREATE TABLE page_texts (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page INTEGER NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (document_id, page)
  );
  CREATE TABLE highlights (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    start_page INTEGER NOT NULL,
    start_offset INTEGER NOT NULL,
    end_page INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    quote TEXT NOT NULL,
    created_at TEXT NOT NULL,
    note_text TEXT,
    note_updated_at TEXT
  );
  CREATE INDEX highlights_by_document ON highlights(document_id, start_page, start_offset);
  `,
  // Reading Position: both set together, or both null (never read).
  `
  ALTER TABLE documents ADD COLUMN last_read_page INTEGER;
  ALTER TABLE documents ADD COLUMN last_read_at TEXT;
  `,
  // Highlights: start before end in reading order, enforced by the schema as
  // well as the module. SQLite can't add a CHECK to an existing table, so
  // rebuild it.
  `
  CREATE TABLE highlights_new (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    start_page INTEGER NOT NULL,
    start_offset INTEGER NOT NULL,
    end_page INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    quote TEXT NOT NULL,
    created_at TEXT NOT NULL,
    note_text TEXT,
    note_updated_at TEXT,
    CHECK (start_page < end_page OR (start_page = end_page AND start_offset < end_offset))
  );
  INSERT INTO highlights_new (id, document_id, start_page, start_offset, end_page, end_offset, quote, created_at)
    SELECT id, document_id, start_page, start_offset, end_page, end_offset, quote, created_at FROM highlights;
  DROP TABLE highlights;
  ALTER TABLE highlights_new RENAME TO highlights;
  CREATE INDEX highlights_by_document ON highlights(document_id, start_page, start_offset);
  `,
];

export function openDb(file: string): Db {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
