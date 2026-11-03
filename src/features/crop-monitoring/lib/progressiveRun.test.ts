import { describe, expect, it, vi } from "vitest";
import { progressiveRun } from "./progressiveRun";
import type { CropMonitoringResult, SubAnalysisKey } from "../types";

const result = (section: SubAnalysisKey) => ({ sub_analyses: { [section]: { available: true } }, skipped: [] }) as unknown as CropMonitoringResult;

describe("progressive crop monitoring", () => {
  it("publishes the fast section before slow work and preserves it after a failure", async () => {
    let finishHealth!: (value: CropMonitoringResult) => void;
    const health = new Promise<CropMonitoringResult>((resolve) => { finishHealth = resolve; });
    const publish = vi.fn();
    const failed = vi.fn();
    const pending = progressiveRun({ field_id: 3, sub_analyses: ["landcover", "health", "weather"] }, async (request) => {
      if (request.sub_analyses?.includes("health")) return health;
      if (request.sub_analyses?.includes("weather")) throw new Error("weather unavailable");
      return result("landcover");
    }, publish, vi.fn(), failed, () => true);
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(publish.mock.calls[0][0].sub_analyses.landcover.available).toBe(true);
    finishHealth(result("health"));
    await pending;
    expect(publish.mock.lastCall?.[0].sub_analyses).toHaveProperty("landcover");
    expect(publish.mock.lastCall?.[0].sub_analyses).toHaveProperty("health");
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("ignores late results after the selected field changes", async () => {
    let current = true;
    let resolve!: (value: CropMonitoringResult) => void;
    const response = new Promise<CropMonitoringResult>((done) => { resolve = done; });
    const publish = vi.fn();
    const pending = progressiveRun({ field_id: 3, sub_analyses: ["health"] }, () => response, publish, vi.fn(), vi.fn(), () => current);
    current = false;
    resolve(result("health"));
    await pending;
    expect(publish).not.toHaveBeenCalled();
  });

  it("limits concurrency to two and derives risk after sections complete", async () => {
    let active = 0;
    let peak = 0;
    const run = vi.fn(async (request) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return result(request.sub_analyses[0]);
    });
    await progressiveRun({ field_id: 3, sub_analyses: ["landcover", "health", "weather", "anomaly", "risk_score"] }, run, vi.fn(), vi.fn(), vi.fn(), () => true);
    expect(peak).toBe(2);
    expect(run.mock.lastCall?.[0].sub_analyses).toContain("risk_score");
    expect(run.mock.calls.slice(0, -1).every(([request]) => !request.sub_analyses.includes("risk_score"))).toBe(true);
  });
});
