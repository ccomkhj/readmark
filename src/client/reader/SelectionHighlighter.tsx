import { useEffect, useRef, useState } from "react";
import type { Anchor } from "../../shared/api-types.ts";
import { mapSelection, type MappedSelection } from "./selection-mapping.ts";
import type { PdfViewer } from "./pdf-viewer.ts";

/** Keyboard shortcut (no modifiers) that highlights the current selection. */
const SHORTCUT = "h";

/** Room the button needs above the selection's last line, px (its height plus a gap). */
const BUTTON_ROOM = 36;
const BUTTON_GAP = 6;

/** Where to put the button: `y` is its bottom edge when `above`, else its top edge. */
type Pending = MappedSelection & { x: number; y: number; above: boolean };

/**
 * Shows a "Highlight" button just above the end of a non-empty text selection
 * in the pages (below it if there's no room above), and handles the keyboard
 * shortcut. Whitespace-only selections (and ones outside the text) map to
 * nothing, so no button appears and the shortcut is a no-op. On success the
 * selection is cleared; on failure `onCreate` rejects, the selection is kept
 * and the button hides until the selection changes.
 */
export function SelectionHighlighter({
  viewer,
  onCreate,
}: {
  viewer: PdfViewer;
  onCreate: (start: Anchor, end: Anchor) => Promise<unknown>;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  /** Key of the selection whose Highlight just failed: no button for it. */
  const failed = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let pointerDown = false;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selection = currentSelection(viewer);
        if (!selection || selectionKey(selection) !== failed.current) failed.current = null;
        setPending(pointerDown || failed.current ? null : selection);
      });
    };
    const onPointerDown = (e: PointerEvent) => {
      // Pressing the Highlight button itself must not hide it before its click.
      if ((e.target as Element | null)?.closest?.(".highlight-action")) return;
      pointerDown = true;
      update();
    };
    const onPointerUp = () => {
      pointerDown = false;
      update();
    };
    const scroller = viewer.scrollContainer;
    document.addEventListener("selectionchange", update);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    scroller.addEventListener("scroll", update, { passive: true });
    const offRendered = viewer.on("pageRendered", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      scroller.removeEventListener("scroll", update);
      offRendered();
    };
  }, [viewer]);

  const highlight = async () => {
    const selection = currentSelection(viewer);
    if (!selection || busy) return;
    setBusy(true);
    try {
      await onCreate(selection.start, selection.end);
      window.getSelection()?.removeAllRanges();
    } catch {
      // onCreate reports the error; keep the selection so the reader sees what failed.
      failed.current = selectionKey(selection);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== SHORTCUT || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isEditable(e.target)) return;
      if (!currentSelection(viewer)) return;
      e.preventDefault();
      void highlight();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!pending) return null;
  return (
    <button
      type="button"
      className="highlight-action"
      style={pending.above ? { left: pending.x, bottom: window.innerHeight - pending.y } : { left: pending.x, top: pending.y }}
      // Keep the selection: a mousedown on a button would otherwise clear it.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void highlight()}
      disabled={busy}
      title={`Highlight selection (${SHORTCUT.toUpperCase()})`}
    >
      Highlight
    </button>
  );
}

/** The current selection mapped to anchors, with a button position at its end (viewport px). */
function currentSelection(viewer: PdfViewer): Pending | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const mapped = mapSelection(viewer, range);
  if (!mapped) return null;
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  // The lowest line of the selection (rect order isn't reliably visual order).
  const last = rects.reduce<DOMRect | undefined>((a, r) => (!a || r.bottom > a.bottom ? r : a), undefined) ??
    range.getBoundingClientRect();
  const x = Math.min(Math.max(last.right - 40, 8), window.innerWidth - 100);
  // Above the last line, unless that would go above the visible page area (under the toolbar).
  const pagesTop = viewer.scrollContainer.getBoundingClientRect().top;
  const above = last.top - BUTTON_ROOM >= pagesTop;
  // Clamped so the button stays on screen when the selection's end is scrolled out below.
  const y = above
    ? Math.min(last.top - BUTTON_GAP, window.innerHeight - BUTTON_GAP)
    : Math.min(last.bottom + BUTTON_GAP, window.innerHeight - BUTTON_ROOM);
  return { ...mapped, x, y, above };
}

function selectionKey({ start, end }: MappedSelection): string {
  return `${start.page}:${start.offset}-${end.page}:${end.offset}`;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
