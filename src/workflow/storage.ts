import type { WorkflowDefinition } from "@/workflow/types";
import { migrateWorkflow } from "@/workflow/validation";

const KEY = "savegeo.workflow.draft.v1";
export function loadWorkflowDraft(): WorkflowDefinition | null {
  try { const raw = localStorage.getItem(KEY); return raw ? migrateWorkflow(JSON.parse(raw)) : null; } catch { return null; }
}
export function saveWorkflowDraft(workflow: WorkflowDefinition): void {
  try { localStorage.setItem(KEY, JSON.stringify(workflow)); } catch { /* private browsing/storage quota */ }
}
export function clearWorkflowDraft(): void { try { localStorage.removeItem(KEY); } catch { /* noop */ } }
