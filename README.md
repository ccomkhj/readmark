# Readmark

Highlight passages in your PDFs, add your own notes, and export them as clean Markdown for an AI to summarize.

https://github.com/user-attachments/assets/d5d5ce0c-70cf-49d3-82a5-2765ffe2e09f

- **Local-only.** It runs on your machine, makes no network calls, and needs no account.
- **Leaves your PDFs alone.** It never modifies the file. Highlights live in the app's own library, keyed by the PDF's content, so moving or renaming the original breaks nothing.
- **Agent-friendly export.** Every quote is exact and in reading order, with page numbers and your notes underneath.

## Quick start

Requires Node.js 22.13 or newer to build. Clone and install once:

```sh
git clone https://github.com/ccomkhj/readmark.git
cd readmark
npm install
```

Then pick how you want to run it. Both share the same library, so you can switch any time.

### macOS app (recommended on a Mac)

```sh
npm run desktop:package
```

This builds `release/mac-arm64/Readmark.app` and a `.dmg` (Apple Silicon). Drag the app into `/Applications` and open it like any other app: no terminal, no server to start, no open port.

The app is not notarized, so the first time you open it, right-click it and choose *Open*. After pulling new code, run `npm run desktop:package` again and replace the app.

### In the browser

```sh
npm start
```

Open <http://127.0.0.1:4310>. Stop it with Ctrl-C.

## How it works

Import a PDF, select sentences to highlight, attach notes, then *Copy* or *Download* from the reader toolbar. Scanned, encrypted and invalid PDFs are rejected.

An export looks like this:

```markdown
# Thinking, Fast and Slow

Author: Daniel Kahneman

These are a reader's Highlights and Notes from this document, in reading order.

**p. 20**

> A reliable way to make people believe in falsehoods is frequent repetition.

**Note:** Same mechanism behind ad retargeting?
```

## More

Configuration (port, data directory) and development setup: [`docs/reference.md`](docs/reference.md).

## License

[Apache 2.0](LICENSE)
