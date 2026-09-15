import { describe, expect, it } from "vitest";
import { validateWorkflow, migrateWorkflow } from "@/workflow/validation";
import type { WorkflowDefinition } from "@/workflow/types";

const workflow = (edges: WorkflowDefinition["edges"]): WorkflowDefinition => ({ version: 1, schemaVersion: 1, name: "Test", category: "general", visibility: "private", inputs: [], nodes: [{ id: "a", type: "load_aoi", label: "AOI", position: { x: 0, y: 0 }, params: {} }, { id: "b", type: "ndvi", label: "NDVI", position: { x: 1, y: 0 }, params: {} }], edges });
describe("workflow validation", () => {
  it("detects circular dependencies", () => { expect(validateWorkflow(workflow([{ id: "1", source: "a", target: "b" }, { id: "2", source: "b", target: "a" }])).errors.join(" ")).toContain("circular"); });
  it("migrates an older minimal definition to schema v1", () => { expect(migrateWorkflow({ name: "Old", nodes: [] })).toMatchObject({ name: "Old", version: 1, schemaVersion: 1 }); });
});
