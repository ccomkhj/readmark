import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { HighlightDto } from "../../shared/api-types.ts";
import { highlightIdAt } from "./highlight-overlays.ts";
import { noteSaveAction } from "./note-draft.ts";
import type { PdfViewer } from "./pdf-viewer.ts";
import type { HighlightsState } from "./use-highlights.ts";

type Actions = Pick<HighlightsState, "setNote" | "clearNote" | "remove">;

/**
 * Note editor panel. A plain click on a Highlight in the pages (not the end of
 * a text selection) makes it the active Highlight and opens this panel with its
 * quote and Note; a click elsewhere in the pages closes it. The Note saves on
 * blur and on Cmd/Ctrl+Enter (Escape saves and closes). The panel also deletes
 * the Highlight. Active-Highlight state is owned by the caller so the overlays
 * can mark it.
 */
export function NoteEditor({
  viewer,
  highlights,
  activeId,
  onActiveChange,
  actions,
}: {
  viewer: PdfViewer;
  highlights: readonly HighlightDto[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  actions: Actions;
}) {
  useEffect(() => {
    const scroller = viewer.pageElement(1).closest(".reader-scroll");
    const onClick = (e: Event) => {
      const { clientX, clientY } = e as MouseEvent;
      if (!window.getSelection()?.isCollapsed) return;
      onActiveChange(highlightIdAt(viewer, clientX, clientY));
    };
    scroller?.addEventListener("click", onClick);
    return () => scroller?.removeEventListener("click", onClick);
  }, [viewer, onActiveChange]);

  const highlight = highlights.find((h) => h.id === activeId);
  if (!highlight) return null;
  return <Panel key={highlight.id} highlight={highlight} actions={actions} onClose={() => onActiveChange(null)} />;
}

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

function Panel({ highlight, actions, onClose }: { highlight: HighlightDto; actions: Actions; onClose: () => void }) {
  const [draft, setDraft] = useState(highlight.note?.text ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedText = highlight.note?.text ?? null;

  useEffect(() => textareaRef.current?.focus(), []);

  /** Save the draft if it changed; resolves false if saving failed. */
  const save = async (): Promise<boolean> => {
    const action = noteSaveAction(savedText, draft);
    if (action.kind === "none") return true;
    setStatus({ kind: "saving" });
    try {
      if (action.kind === "put") await actions.setNote(highlight.id, action.text);
      else await actions.clearNote(highlight.id);
      setStatus({ kind: "saved" });
      return true;
    } catch (e) {
      setStatus({ kind: "error", message: `Could not save the Note: ${(e as Error).message}` });
      return false;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      void save().then((ok) => ok && onClose());
    }
  };

  const deleteHighlight = async () => {
    if (savedText !== null && !window.confirm("Delete this Highlight and its Note?")) return;
    try {
      await actions.remove(highlight.id);
    } catch (e) {
      setStatus({ kind: "error", message: `Could not delete the Highlight: ${(e as Error).message}` });
    }
  };

  const page =
    highlight.start.page === highlight.end.page ? `p. ${highlight.start.page}` : `pp. ${highlight.start.page}–${highlight.end.page}`;

  return (
    <section className="note-editor" aria-label="Note">
      <header className="note-editor-header">
        <span className="note-editor-page">{page}</span>
        <button type="button" className="note-editor-close" onClick={onClose} aria-label="Close Note editor">
          ×
        </button>
      </header>
      <blockquote className="note-editor-quote">{highlight.quote}</blockquote>
      <textarea
        ref={textareaRef}
        className="note-editor-text"
        aria-label="Note text"
        placeholder="Your thoughts (Markdown). Saves on leave or Cmd/Ctrl+Enter."
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus({ kind: "idle" });
        }}
        onBlur={() => void save()}
        onKeyDown={onKeyDown}
        rows={6}
      />
      <footer className="note-editor-footer">
        <span className={`note-editor-status${status.kind === "error" ? " error" : ""}`} role="status">
          {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? "Saved" : status.kind === "error" ? status.message : ""}
        </span>
        <button type="button" className="note-editor-delete" onClick={() => void deleteHighlight()}>
          Delete Highlight
        </button>
      </footer>
    </section>
  );
}
