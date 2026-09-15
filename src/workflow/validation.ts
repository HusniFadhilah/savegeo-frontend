import type { WorkflowDefinition } from "@/workflow/types";

export interface WorkflowValidation { valid: boolean; errors: string[]; warnings: string[] }

export function validateWorkflow(workflow: WorkflowDefinition): WorkflowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (workflow.version !== 1 || workflow.schemaVersion !== 1) errors.push("WORKFLOW_SCHEMA_UNSUPPORTED");
  if (!workflow.name.trim()) errors.push("WORKFLOW_INVALID");
  const ids = new Set(workflow.nodes.map((node) => node.id));
  if (ids.size !== workflow.nodes.length) errors.push("WORKFLOW_INVALID: duplicate node id");
  const incoming = new Map<string, number>(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(workflow.nodes.map((node) => [node.id, []]));
  for (const edge of workflow.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push("WORKFLOW_INVALID: unknown edge node");
    if (edge.source === edge.target) errors.push("WORKFLOW_INVALID: self edge");
    if (ids.has(edge.target)) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    if (outgoing.has(edge.source)) outgoing.get(edge.source)!.push(edge.target);
  }
  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  if (visited !== workflow.nodes.length) errors.push("WORKFLOW_INVALID: circular dependency");
  workflow.nodes.forEach((node) => {
    if ((incoming.get(node.id) ?? 0) === 0 && workflow.nodes.length > 1 && !outgoing.get(node.id)?.length) warnings.push(`Node ${node.label} is not connected`);
  });
  workflow.inputs.filter((input) => input.required).forEach((input) => {
    if (input.value === undefined || input.value === null || input.value === "") warnings.push(`Input ${input.label} is not configured`);
  });
  return { valid: errors.length === 0, errors, warnings };
}

export function migrateWorkflow(input: unknown): WorkflowDefinition {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<WorkflowDefinition>;
  return {
    version: 1,
    schemaVersion: 1,
    id: raw.id,
    name: raw.name || "Untitled workflow",
    description: raw.description,
    category: raw.category || "general",
    visibility: raw.visibility || "private",
    inputs: raw.inputs || [],
    nodes: raw.nodes || [],
    edges: raw.edges || [],
    metadata: raw.metadata,
  };
}
