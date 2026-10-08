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

describe("analysis completion contract", () => {
  it("reports backend failures even when an earlier result exists", async () => {
    const dispose = registerUiCommands("carbon", { read: () => ({ hasResult: true, error: "Scene unavailable" }), execute: async () => {} });
    try {
      await expect(executeUiCommand({ action: "run_analysis", target: "carbon.analysis" })).rejects.toThrow("Scene unavailable");
    } finally { dispose(); }
  });
  it("rejects completion without a backend result", async () => {
    const dispose = registerUiCommands("carbon", { read: () => ({ hasResult: false }), execute: async () => {} });
    try {
      await expect(executeUiCommand({ action: "run_analysis", target: "carbon.analysis" })).rejects.toThrow(/tanpa hasil/);
    } finally { dispose(); }
  });
});


it("waits for the owner to commit a parameter before the next analysis uses it", async () => {
  let analysisType = "carbon";
  let usedType = "";
  const dispose = registerUiCommands("carbon", {
    read: () => ({ analysisType, hasResult: usedType === "vegetation" }),
    execute: ({ action }) => {
      if (action === "set_analysis_type") setTimeout(() => { analysisType = "vegetation"; }, 50);
      if (action === "run_analysis") usedType = analysisType;
    },
  });
  try {
    await executeUiCommand({ action: "set_analysis_type", target: "carbon.analysisType", parameters: { value: "vegetation" }, expected_state: { analysisType: "vegetation" } });
    await executeUiCommand({ action: "run_analysis", target: "carbon.analysis" });
    expect(usedType).toBe("vegetation");
  } finally { dispose(); }
});


it("uses the current API outcome when React still exposes a previous error", async () => {
  const dispose = registerUiCommands("carbon", {
    read: () => ({ hasResult: false, error: "Previous carbon error" }),
    execute: async () => ({ hasResult: true, error: null }),
  });
  try {
    await expect(executeUiCommand({ action: "run_analysis", target: "carbon.analysis" })).resolves.toMatchObject({ hasResult: true, error: null });
  } finally { dispose(); }
});

it("uses a failed API outcome even if React still exposes a previous result", async () => {
  const dispose = registerUiCommands("carbon", {
    read: () => ({ hasResult: true, error: null }),
    execute: async () => ({ hasResult: false, error: "No valid vegetation pixels" }),
  });
  try {
    await expect(executeUiCommand({ action: "run_analysis", target: "carbon.analysis" })).rejects.toThrow("No valid vegetation pixels");
  } finally { dispose(); }
});
