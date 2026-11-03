/**
 * Reader view preferences, kept in this browser's localStorage: they're about
 * how this screen shows a Document, not about the Document, so the server
 * doesn't store them.
 *
 * - Zoom: per Document, so each opens at the size last read at.
 * - Night and Focus mode: one setting for every Document.
 *
 * Stored values are input from outside the app (the user or another version
 * can change them): anything not valid reads as unset.
 */
import { useCallback, useState } from "react";

const PREFIX = "readmark.reader.";

function read(key: string): string | null {
  return localStorage.getItem(PREFIX + key);
}

function write(key: string, value: string): void {
  localStorage.setItem(PREFIX + key, value);
}

/** The zoom the Document was last read at, if it is a valid one. */
export function loadZoom(documentId: string, isValid: (scale: number) => boolean): number | undefined {
  const scale = Number(read(`zoom.${documentId}`));
  return Number.isFinite(scale) && isValid(scale) ? scale : undefined;
}

export function saveZoom(documentId: string, scale: number): void {
  write(`zoom.${documentId}`, String(scale));
}

export type ReaderMode = "night" | "focus";

/** A Reader mode switch that survives reloads. Starts off. */
export function useReaderMode(mode: ReaderMode): [on: boolean, toggle: () => void] {
  const [on, setOn] = useState(() => read(mode) === "on");
  const toggle = useCallback(() => {
    setOn((was) => {
      write(mode, was ? "off" : "on");
      return !was;
    });
  }, [mode]);
  return [on, toggle];
}
