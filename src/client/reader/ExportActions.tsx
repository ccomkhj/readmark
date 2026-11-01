import { useEffect, useState } from "react";
import { getInsightExport } from "../api.ts";

const STATUS_MS = 2500;

/**
 * Insight Export actions for the Reader toolbar. Download saves the Markdown
 * under the server's file name; Copy puts it on the clipboard. Both fetch a
 * fresh export, so they match the endpoint byte for byte.
 */
export function ExportActions({ documentId }: { documentId: string }) {
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const fail = (e: unknown) => setStatus({ text: `Export failed: ${(e as Error).message}`, error: true });

  const download = async () => {
    try {
      const { fileName, markdown } = await getInsightExport(documentId);
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
      const a = Object.assign(window.document.createElement("a"), { href: url, download: fileName });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      fail(e);
    }
  };

  const copy = async () => {
    try {
      // A ClipboardItem with a pending Blob keeps the user gesture across the fetch (Safari requires it).
      const blob = getInsightExport(documentId).then(({ markdown }) => new Blob([markdown], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      setStatus({ text: "Copied to clipboard", error: false });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="reader-export" role="group" aria-label="Insight Export">
      <span className={status?.error ? "message error" : "message info"} role="status">
        {status?.text}
      </span>
      <button type="button" onClick={download} title="Download the Insight Export as Markdown">
        Download
      </button>
      <button type="button" onClick={copy} title="Copy the Insight Export to the clipboard">
        Copy
      </button>
    </div>
  );
}
