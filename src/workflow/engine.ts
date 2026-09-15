import type { WorkflowDefinition, WorkflowNode, WorkflowRun, ExecutionLocation, NodeRunStatus } from "@/workflow/types";
import { validateWorkflow } from "@/workflow/validation";

export async function executeWorkflow(workflow: WorkflowDefinition, location: ExecutionLocation, onUpdate: (run: WorkflowRun) => void, signal?: AbortSignal): Promise<WorkflowRun> {
  const validation = validateWorkflow(workflow);
  if (!validation.valid) throw new Error(validation.errors.join(", "));
  const startedAt = new Date().toISOString();
  const statuses: Record<string, NodeRunStatus> = Object.fromEntries(workflow.nodes.map((node) => [node.id, "pending"]));
  const run: WorkflowRun = { id: `local-${Date.now()}`, workflowId: workflow.id || "draft", status: "running", executionLocation: location === "auto" ? "browser" : location, nodeStatuses: statuses, provenance: { workflowVersion: workflow.version, schemaVersion: workflow.schemaVersion, executionLocation: location === "auto" ? "browser" : location, startedAt, nodes: workflow.nodes.map((node) => ({ id: node.id, type: node.type, params: node.params })) } };
  onUpdate({ ...run, nodeStatuses: { ...statuses } });
  for (const node of workflow.nodes) {
    if (signal?.aborted) { run.status = "cancelled"; Object.keys(statuses).forEach((id) => { if (statuses[id] === "pending") statuses[id] = "cancelled"; }); onUpdate({ ...run, nodeStatuses: { ...statuses } }); return run; }
    statuses[node.id] = "running"; onUpdate({ ...run, nodeStatuses: { ...statuses } });
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    statuses[node.id] = "completed"; onUpdate({ ...run, nodeStatuses: { ...statuses } });
  }
  run.status = "completed"; run.completedAt = new Date().toISOString(); run.nodeStatuses = { ...statuses }; run.provenance = { ...run.provenance, completedAt: run.completedAt, outputReference: `local-cache://${run.id}` }; onUpdate(run); return run;
}

export function getReadyNodes(workflow: WorkflowDefinition, completed: Set<string>): WorkflowNode[] {
  return workflow.nodes.filter((node) => !completed.has(node.id) && workflow.edges.filter((edge) => edge.target === node.id).every((edge) => completed.has(edge.source)));
}
