import { describe, expect, it } from "vitest";
import { pageReference } from "../../src/shared/page-reference.ts";

describe("pageReference", () => {
  it("names a single page for a Highlight on one page", () => {
    expect(pageReference({ page: 3, offset: 0 }, { page: 3, offset: 40 })).toBe("p. 3");
  });

  it("names a page range for a Highlight crossing a page break", () => {
    expect(pageReference({ page: 1, offset: 120 }, { page: 2, offset: 15 })).toBe("pp. 1–2");
  });
});
