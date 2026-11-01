import { describe, expect, it } from "vitest";
import { noteSaveAction } from "../../src/client/reader/note-draft.ts";

describe("noteSaveAction: what saving a Note draft does", () => {
  it("saves new text on a Highlight without a Note, verbatim", () => {
    expect(noteSaveAction(null, "  why *this* matters\n\n- a\n")).toEqual({
      kind: "put",
      text: "  why *this* matters\n\n- a\n",
    });
  });

  it("does nothing when the draft equals the saved Note", () => {
    expect(noteSaveAction("same", "same")).toEqual({ kind: "none" });
  });

  it("does nothing for an empty or whitespace-only draft when there is no Note", () => {
    expect(noteSaveAction(null, "")).toEqual({ kind: "none" });
    expect(noteSaveAction(null, " \n\t")).toEqual({ kind: "none" });
  });

  it("removes the Note when an existing Note is cleared to whitespace", () => {
    expect(noteSaveAction("old", "")).toEqual({ kind: "clear" });
    expect(noteSaveAction("old", "  \n ")).toEqual({ kind: "clear" });
  });

  it("replaces an existing Note with edited text", () => {
    expect(noteSaveAction("old", "new\nline")).toEqual({ kind: "put", text: "new\nline" });
  });
});
