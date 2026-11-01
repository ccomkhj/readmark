import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { HighlightDto } from "../../shared/api-types.ts";
import { pageReference } from "../../shared/page-reference.ts";
import { noteSaveAction } from "./note-draft.ts";
import type { HighlightsState } from "./use-highlights.ts";

export type NoteActions = Pick<HighlightsState, "setNote" | "clearNote" | "remove">;

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

/**
 * Note editor for the active Highlight, shown in place of its Highlights
 * sidebar entry: page reference, quote, Note text and Delete Highlight. The
 * Note saves on blur and on Cmd/Ctrl+Enter (Escape saves and closes); a
 * whitespace-only Note removes it. Mount with `key={highlight.id}` so each
 * Highlight starts from its own saved Note. Takes focus on mount.
 */
export function NoteEditor({
  highlight,
  actions,
  onClose,
}: {
  highlight: HighlightDto;
  actions: NoteActions;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(highlight.note?.text ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedText = highlight.note?.text ?? null;

  // The sidebar scrolls the editor into view itself.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    // Continue an existing Note rather than typing in front of it.
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

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
    // Confirm when there is a Note to lose: saved, or typed but not saved yet.
    const hasNote = savedText !== null || draft.trim() !== "";
    if (hasNote && !window.confirm("Delete this Highlight and its Note?")) return;
    try {
      await actions.remove(highlight.id);
    } catch (e) {
      setStatus({ kind: "error", message: `Could not delete the Highlight: ${(e as Error).message}` });
    }
  };

  return (
    <section className="note-editor" aria-label="Note">
      <header className="note-editor-header">
        <span className="note-editor-page">{pageReference(highlight.start, highlight.end)}</span>
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
        <button
          type="button"
          className="note-editor-delete"
          // Keep focus in the textarea: its blur would save the draft just before deleting.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void deleteHighlight()}
        >
          Delete Highlight
        </button>
      </footer>
    </section>
  );
}
