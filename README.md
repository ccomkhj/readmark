# Readmark

Highlight passages in your PDFs, add your own notes, and export them as clean Markdown for an AI to summarize.

PDF readers lock your highlights inside the file or the app. Readmark keeps them as data. Select a sentence and it becomes a highlight; attach a thought and it becomes a note. One click turns everything into a Markdown file you can paste into ChatGPT, Claude, or any other agent.

- **Local-only.** It runs on your machine, makes no network calls, and needs no account.
- **Leaves your PDFs alone.** It never modifies the file. Highlights live in the app's own library, keyed by the PDF's content, so moving or renaming the original breaks nothing.
- **Agent-friendly export.** Every quote is exact and in reading order, with page numbers and your notes underneath.

## Quick start

Requires Node.js 22.13 or newer.

```sh
git clone https://github.com/ccomkhj/readmark.git
cd readmark
npm install
npm start
```

Open <http://127.0.0.1:4310>.

## How it works

1. **Import** a PDF with the file picker or by dragging it onto the Library. Scanned (image-only), encrypted, and invalid PDFs are rejected with a clear message.
2. **Read** in the browser with continuous scroll, zoom, and jump-to-page.
3. **Highlight** by selecting one or more sentences. A highlight can cross a page break.
4. **Note**: attach your own words to a highlight. Markdown is kept exactly as you write it.
5. **Export** from the reader toolbar. *Download* saves a `.md` file; *Copy* puts it on your clipboard.

An export looks like this:

```markdown
# Thinking, Fast and Slow

Author: Daniel Kahneman

These are a reader's Highlights and Notes from this document, in reading order.

**p. 20**

> A reliable way to make people believe in falsehoods is frequent repetition.

**Note:** Same mechanism behind ad retargeting?
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4310` | HTTP port. The server always binds to `127.0.0.1`. |
| `READMARK_DATA_DIR` | OS app-data dir (see below) | Where the library and database are stored. |

Default data directory:

- macOS: `~/Library/Application Support/readmark`
- Linux: `$XDG_DATA_HOME/readmark` (falls back to `~/.local/share/readmark`)
- Windows: `%APPDATA%\readmark`

## Development

```sh
npm run dev         # API + Vite dev server with hot reload
npm test            # Vitest
npm run typecheck
```

Stack: React and PDF.js in the browser; Hono and SQLite (better-sqlite3) on the server.

The domain vocabulary is defined in [`GLOSSARY.md`](GLOSSARY.md), and design decisions are recorded in [`docs/adr/`](docs/adr/).

## License

[Apache 2.0](LICENSE)
