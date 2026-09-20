import { describe, expect, it } from "vitest";
import { executeUiCommand, registerUiCommands } from "./uiCommandBus";

describe("UI command bus", () => {
  it("executes through the owning module and verifies the resulting state", async () => {
    let year = 2023;
    const dispose = registerUiCommands("carbon", {
      read: () => ({ analysisYear: year }),
      execute: ({ action, target, parameters }) => {
        if (action !== "set_parameter" || target !== "carbon.analysisYear") throw new Error("unsupported");
        year = parameters?.value as number;
      },
    });
    try {
      await expect(executeUiCommand({
        action: "set_parameter", target: "carbon.analysisYear",
        parameters: { value: 2024 }, expected_state: { analysisYear: 2024 },
      })).resolves.toMatchObject({ analysisYear: 2024 });
      await expect(executeUiCommand({
        action: "set_parameter", target: "carbon.analysisYear",
        parameters: { value: 2025 }, expected_state: { analysisYear: 2024 },
      })).rejects.toThrow(/state analysisYear/);
    } finally {
      dispose();
    }
  });

  it("fails when a module has no registered command handler", async () => {
    await expect(executeUiCommand({ action: "set_parameter", target: "missing.year", parameters: { value: 2024 } }))
      .rejects.toThrow(/belum menyediakan kontrol/);
  });
});
