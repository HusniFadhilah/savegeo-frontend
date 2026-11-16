import { expect, it } from "vitest";
import { safeHttpUrl } from "./safeHttpUrl";

it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example", "https://user:password@example.test/file", "https://example.test/\nfile", null])("rejects unsafe external link %s", (value) => {
  expect(safeHttpUrl(value)).toBeUndefined();
});

it("permits ordinary absolute provider links", () => {
  expect(safeHttpUrl("https://example.test/data?id=1")).toBe("https://example.test/data?id=1");
});
