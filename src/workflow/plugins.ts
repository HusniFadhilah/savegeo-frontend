import type { WorkflowNode } from "@/workflow/types";

export type PluginCapability = "raster-tool" | "imagery-provider" | "workflow-node" | "map-layer" | "widget" | "exporter";
export interface SaveGeoPluginManifest { id: string; name: string; version: string; apiVersion: string; description?: string; author?: string; capabilities: PluginCapability[]; permissions?: ("network" | "local-files" | "backend-api" | "storage")[]; entry: string }
export interface RegisteredWorkflowNode { type: string; label: string; category: string; inputPorts: string[]; outputPorts: string[]; parameterSchema: Record<string, unknown>; execute?: (input: unknown, params: Record<string, unknown>) => Promise<unknown> }
export interface SaveGeoPluginContext { registerWorkflowNode: (node: RegisteredWorkflowNode) => void; logger: Pick<Console, "info" | "error"> }
export interface SaveGeoPlugin { manifest: SaveGeoPluginManifest; activate: (context: SaveGeoPluginContext) => void | Promise<void>; deactivate?: () => void | Promise<void> }

const nodes = new Map<string, RegisteredWorkflowNode>();
const plugins = new Map<string, SaveGeoPluginManifest & { enabled: boolean; lastError?: string }>();
export const pluginRegistry = {
  register(plugin: SaveGeoPlugin) {
    if (plugin.manifest.apiVersion !== "1") throw new Error("PLUGIN_INCOMPATIBLE");
    const manifest = { ...plugin.manifest, enabled: true };
    plugins.set(plugin.manifest.id, manifest);
    void Promise.resolve(plugin.activate({ registerWorkflowNode: (node) => nodes.set(node.type, node), logger: console })).catch((error: unknown) => { plugins.set(plugin.manifest.id, { ...manifest, enabled: false, lastError: String(error) }); });
  },
  toggle(id: string, enabled: boolean) { const plugin = plugins.get(id); if (plugin) plugins.set(id, { ...plugin, enabled }); },
  list: () => [...plugins.values()],
  nodeCatalog: () => [...nodes.values()],
};

const builtIn: SaveGeoPlugin = { manifest: { id: "savegeo-core", name: "SaveGeo Core", version: "1.0.0", apiVersion: "1", description: "Built-in workflow nodes", author: "SaveGeo", capabilities: ["workflow-node"], permissions: [], entry: "built-in" }, activate: ({ registerWorkflowNode }) => { registerWorkflowNode({ type: "ndvi", label: "NDVI", category: "analysis", inputPorts: ["raster"], outputPorts: ["raster"], parameterSchema: {} }); } };
pluginRegistry.register(builtIn);

export function isRegisteredPluginNode(node: WorkflowNode): boolean { return node.type === "ndvi" || Boolean(pluginRegistry.nodeCatalog().find((item) => item.type === node.type)); }
