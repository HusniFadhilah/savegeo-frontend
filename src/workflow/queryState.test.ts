import { describe, expect, it } from "vitest";
import { canonicalWorkflowUrl, parseWorkflowQuery, serializeWorkflowQuery } from "@/workflow/queryState";

describe("workflow query state", () => {
  it("parses supported values and ignores invalid numeric/date state", () => {
    const state = parseWorkflowQuery("?mode=vegetation&tool=ndvi&year=2026&time=2026-01-01&zoom=8&lat=91&date=not-a-date&execution=backend");
    expect(state.mode).toBe("vegetation");
    expect(state.year).toBe(2026);
    expect(state.time).toBe("2026-01-01");
    expect(state.lat).toBeUndefined();
    expect(state.date).toBeUndefined();
    expect(state.execution).toBe("backend");
  });

  it("serializes a canonical safe URL and falls back when it is too large", () => {
    const query = serializeWorkflowQuery({ workflowId: "abc123", steps: ["load_aoi", "ndvi"], view: "3d" });
    expect(query.toString()).toBe("workflowId=abc123&view=3d&steps=load_aoi%2Cndvi");
    expect(canonicalWorkflowUrl("/workflow", { workflowId: "abc123", steps: ["load_aoi", "ndvi"] })).toBe("/workflow?workflowId=abc123&steps=load_aoi%2Cndvi");
    expect(canonicalWorkflowUrl("/workflow", { workflowId: "safe", aoi: "x".repeat(3000) })).toBe("/workflow?workflowId=safe");
  });
});
