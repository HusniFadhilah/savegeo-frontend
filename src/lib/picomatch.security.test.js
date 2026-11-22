import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

it("does not backtrack on single-branch repeated wildcard extglobs", () => {
  const source = `
    import picomatch from "./vendor/picomatch/index.js";
    const text = "a".repeat(25000) + "b";
    const first = picomatch("+(*a)")(text);
    const second = picomatch("+(*)")(text);
    process.stdout.write(String(first) + "," + String(second));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 3000,
  });

  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("false,false");
});

it("retains safe character-class reduction for nested repeated extglobs", async () => {
  const { default: picomatch } = await import("../../vendor/picomatch/index.js");

  expect(picomatch("+(*(a)|*(b))")("aab")).toBe(true);
  expect(picomatch("+(*(a)|*(b))")("abx")).toBe(false);
});
