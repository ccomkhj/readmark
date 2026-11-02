/**
 * Keeps the Document's Reading Position on the server in step with the
 * viewer: saves the current page once when the viewer is ready (so opening a
 * Document counts as reading it), then after each page change once scrolling
 * settles, and flushes a pending save when the Reader closes.
 */
import { useEffect } from "react";
import { putReadingPosition } from "../api.ts";
import type { PdfViewer } from "./pdf-viewer.ts";

/** Quiet time after the last page change before the page is saved. */
const SAVE_DELAY_MS = 1000;

export function useReadingPosition(documentId: string, viewer: PdfViewer | null, onError: (e: Error) => void): void {
  useEffect(() => {
    if (!viewer) return;
    let saved: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = undefined;
      const page = viewer.currentPage;
      if (page === saved) return;
      saved = page;
      putReadingPosition(documentId, page).catch(onError);
    };
    save();
    const off = viewer.on("pageChange", () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    });
    return () => {
      off();
      if (timer !== undefined) save();
    };
  }, [documentId, viewer, onError]);
}
