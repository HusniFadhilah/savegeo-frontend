export type WorkflowCategory = "carbon" | "vegetation" | "crop" | "land-cover" | "disaster" | "general";
export type WorkflowVisibility = "private" | "unlisted" | "public";
export type ExecutionLocation = "browser" | "backend" | "auto";
export type WorkflowRunStatus = "idle" | "validating" | "queued" | "running" | "paused" | "cancelled" | "completed" | "failed";
export type NodeRunStatus = "pending" | "running" | "completed" | "skipped" | "failed" | "cancelled";

export interface WorkflowInput {
  id: string;
  type: "aoi" | "raster" | "imagery" | "dem" | "date" | "year" | "threshold" | "model" | "layer";
  label: string;
  required: boolean;
  value?: unknown;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  params: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourcePort?: string;
  target: string;
  targetPort?: string;
}

export interface WorkflowDefinition {
  version: 1;
  schemaVersion: 1;
  id?: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  visibility: WorkflowVisibility;
  inputs: WorkflowInput[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    authorId?: string;
    createdAt?: string;
    updatedAt?: string;
    applicationVersion?: string;
    crs?: string;
    datasetReferences?: string[];
    pluginVersions?: Record<string, string>;
  };
}

export interface Layer3DDefinition {
  id: string;
  name: string;
  type: "3d-tiles" | "terrain" | "extrusion" | "hotspot" | "raster-overlay" | "model";
  visible: boolean;
  opacity?: number;
  source: string | object;
  time?: { start?: string; end?: string };
  style?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  executionLocation: ExecutionLocation;
  nodeStatuses: Record<string, NodeRunStatus>;
  provenance: Record<string, unknown>;
  error?: string | null;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface EmbedConfig {
  workflowId?: string;
  mapId?: string;
  visibleLayers?: string[];
  showLegend: boolean;
  showLayerControl: boolean;
  showTimeSlider: boolean;
  allowInteraction: boolean;
  theme: "light" | "dark" | "system";
}

export const DEFAULT_EMBED_CONFIG: EmbedConfig = {
  showLegend: true,
  showLayerControl: true,
  showTimeSlider: false,
  allowInteraction: true,
  theme: "system",
};
