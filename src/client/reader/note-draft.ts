/** What saving a Note draft should do, given the Highlight's saved Note text. */
export type NoteSaveAction = { kind: "none" } | { kind: "put"; text: string } | { kind: "clear" };

/**
 * Decide the API call for saving `draft` over `saved` (null = no Note).
 * Text is kept verbatim; a whitespace-only draft means "no Note" (spec story 35),
 * so it clears an existing Note and is a no-op otherwise. Unchanged drafts are
 * a no-op, so blur after Cmd/Ctrl+Enter doesn't save twice.
 */
export function noteSaveAction(saved: string | null, draft: string): NoteSaveAction {
  if (draft.trim() === "") return saved === null ? { kind: "none" } : { kind: "clear" };
  if (draft === saved) return { kind: "none" };
  return { kind: "put", text: draft };
}
