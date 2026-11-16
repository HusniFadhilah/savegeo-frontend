import { expect, it, vi } from 'vitest';
import { executeWorkflow } from './engine';
import type { WorkflowDefinition } from './types';

it('never emits completed nodes when no workflow engine is available', async () => {
  const workflow: WorkflowDefinition = { version: 1, schemaVersion: 1, name: 'Saved definition', category: 'general', visibility: 'private', inputs: [], nodes: [{ id: 'a', type: 'load_aoi', label: 'AOI', position: { x: 0, y: 0 }, params: {} }], edges: [] };
  const update = vi.fn();
  await expect(executeWorkflow(workflow, 'auto', update)).rejects.toThrow('workflow.executionUnavailable');
  expect(update).not.toHaveBeenCalled();
});
