import { useCallback, useEffect, useState } from "react";
import type { Anchor, HighlightDto } from "../../shared/api-types.ts";
import { compareAnchors } from "../../shared/page-text.ts";
import { createHighlight, listHighlights } from "../api.ts";

export type HighlightsState = {
  /** The Document's Highlights in reading order; null while loading. */
  highlights: HighlightDto[] | null;
  /** Load failure, if any. */
  loadError: string | null;
  /** Create a Highlight via the API and add it to `highlights`. Rejects with ApiError. */
  create(start: Anchor, end: Anchor): Promise<HighlightDto>;
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

  return { highlights, loadError, create };
}

function readingOrder(a: HighlightDto, b: HighlightDto): number {
  return compareAnchors(a.start, b.start);
}
