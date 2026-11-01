# Reference

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

The domain vocabulary is defined in [`GLOSSARY.md`](../GLOSSARY.md), and design decisions are recorded in [`adr/`](adr/).
