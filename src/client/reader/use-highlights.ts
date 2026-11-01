import { useCallback, useEffect, useState } from "react";
import type { Anchor, HighlightDto } from "../../shared/api-types.ts";
import { compareAnchors } from "../../shared/page-text.ts";
import { createHighlight, deleteHighlight, deleteNote, listHighlights, putNote } from "../api.ts";

export type HighlightsState = {
  /** The Document's Highlights in reading order; null while loading. */
  highlights: HighlightDto[] | null;
  /** Load failure, if any. */
  loadError: string | null;
  /** Create a Highlight via the API and add it to `highlights`. Rejects with ApiError. */
  create(start: Anchor, end: Anchor): Promise<HighlightDto>;
  /** Create or replace a Highlight's Note (text verbatim; whitespace-only removes it). Rejects with ApiError. */
  setNote(id: string, text: string): Promise<HighlightDto>;
  /** Remove a Highlight's Note. Rejects with ApiError. */
  clearNote(id: string): Promise<HighlightDto>;
  /** Delete a Highlight (its Note goes with it) and drop it from `highlights`. Rejects with ApiError. */
  remove(id: string): Promise<void>;
};

/**
 * The Reader's single source of Highlight state for one Document. Features
 * that read or change Highlights (overlays, Note editor, sidebar) share the
 * value returned here; add mutations here rather than keeping copies.
 */
export function useHighlights(documentId: string): HighlightsState {
  const [highlights, setHighlights] = useState<HighlightDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHighlights(null);
    setLoadError(null);
    listHighlights(documentId)
      .then((list) => !cancelled && setHighlights(list))
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const create = useCallback(
    async (start: Anchor, end: Anchor) => {
      const created = await createHighlight(documentId, start, end);
      setHighlights((list) => [...(list ?? []), created].sort(readingOrder));
      return created;
    },
    [documentId],
  );

  const setNote = useCallback(async (id: string, text: string) => replace(setHighlights, await putNote(id, text)), []);

  const clearNote = useCallback(async (id: string) => replace(setHighlights, await deleteNote(id)), []);

  const remove = useCallback(async (id: string) => {
    await deleteHighlight(id);
    setHighlights((list) => list && list.filter((h) => h.id !== id));
  }, []);

  return { highlights, loadError, create, setNote, clearNote, remove };
}

function readingOrder(a: HighlightDto, b: HighlightDto): number {
  return compareAnchors(a.start, b.start);
}

/** Swap in the server's updated copy of a Highlight (same anchors, so order holds). */
function replace(setHighlights: (f: (list: HighlightDto[] | null) => HighlightDto[] | null) => void, updated: HighlightDto) {
  setHighlights((list) => list && list.map((h) => (h.id === updated.id ? updated : h)));
  return updated;
}
