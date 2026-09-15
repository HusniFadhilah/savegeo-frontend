import { describe, expect, it } from "vitest";
import { validateIdentifier, validateSpatialQuery } from "./queryValidation";

describe("safe spatial query validation", () => {
  it("enforces a bounded read-only query", () => {
    expect(validateSpatialQuery("SELECT * FROM scenes", 10)).toBe("SELECT * FROM scenes LIMIT 10");
    expect(validateSpatialQuery("SELECT * FROM scenes LIMIT 999", 10)).toBe("SELECT * FROM scenes LIMIT 10");
  });

  it("rejects mutations and unsafe identifiers", () => {
    expect(() => validateSpatialQuery("DROP TABLE scenes")).toThrow("spatial");
    expect(() => validateIdentifier("scenes; DROP TABLE x")).toThrow("spatial.invalidIdentifier");
  });
});

