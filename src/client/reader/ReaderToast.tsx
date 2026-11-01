import { useEffect } from "react";

/** How long a message stays up before it dismisses itself. */
const AUTO_DISMISS_MS = 5000;

/** A one-off Reader message. Each new object (even with the same text) restarts the timer. */
export type ReaderMessage = { kind: "info" | "error"; text: string };

/**
 * The Reader's message toast: floats over the top of the pages (no layout
 * shift), dismisses itself after AUTO_DISMISS_MS or on its close button.
 * The live region is always in the DOM so screen readers announce each new
 * message (errors assertively).
 */
export function ReaderToast({ message, onDismiss }: { message: ReaderMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="reader-toasts" aria-live={message?.kind === "error" ? "assertive" : "polite"} role="status">
      {message && (
        <div className={`reader-toast ${message.kind}`}>
          <span>{message.text}</span>
          <button type="button" className="reader-toast-close" onClick={onDismiss} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
