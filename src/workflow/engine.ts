import type { WorkflowDefinition, WorkflowNode, WorkflowRun, ExecutionLocation } from "@/workflow/types";
import { validateWorkflow } from "@/workflow/validation";

export async function executeWorkflow(workflow: WorkflowDefinition, _location: ExecutionLocation, _onUpdate: (run: WorkflowRun) => void, _signal?: AbortSignal): Promise<WorkflowRun> {
  const validation = validateWorkflow(workflow);
  if (!validation.valid) throw new Error(validation.errors.join(", "));
  throw new Error("workflow.executionUnavailable");
}

export function getReadyNodes(workflow: WorkflowDefinition, completed: Set<string>): WorkflowNode[] {
  return workflow.nodes.filter((node) => !completed.has(node.id) && workflow.edges.filter((edge) => edge.target === node.id).every((edge) => completed.has(edge.source)));
}
