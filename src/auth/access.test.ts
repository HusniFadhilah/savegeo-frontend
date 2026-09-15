import { describe, expect, it } from "vitest";
import { isViewerRole } from "./access";

describe("isViewerRole", () => {
  it("recognizes viewer regardless of casing and whitespace", () => {
    expect(isViewerRole(" viewer ")).toBe(true);
    expect(isViewerRole("VIEWER")).toBe(true);
  });

  it("does not classify other or missing roles as viewer", () => {
    expect(isViewerRole("administrator")).toBe(false);
    expect(isViewerRole(null)).toBe(false);
    expect(isViewerRole(undefined)).toBe(false);
  });
});
