import type { WorkflowDefinition, WorkflowNode } from "@/workflow/types";

const node = (id: string, type: string, label: string, x: number, params: Record<string, unknown> = {}): WorkflowNode => ({ id, type, label, position: { x, y: 140 }, params });
const make = (name: string, category: WorkflowDefinition["category"], description: string, specs: [string, string][]): WorkflowDefinition => {
  const nodes = specs.map(([type, label], index) => node(`${type}-${index + 1}`, type, label, 24 + index * 176));
  return { version: 1, schemaVersion: 1, name, description, category, visibility: "private", inputs: [{ id: "aoi", type: "aoi", label: "Area of interest", required: true }], nodes, edges: nodes.slice(1).map((current, index) => ({ id: `edge-${index + 1}`, source: nodes[index].id, target: current.id })) };
};

export const WORKFLOW_TEMPLATES: WorkflowDefinition[] = [
  make("Vegetation / NDVI", "vegetation", "Cloud-masked vegetation health workflow.", [["load_aoi", "Load AOI"], ["load_imagery", "Load imagery"], ["cloud_mask", "Mask cloud"], ["ndvi", "NDVI"], ["clip", "Clip"], ["statistics", "Statistics"], ["export", "Export"]]),
  make("Carbon estimation", "carbon", "Estimate carbon from imagery and reference data.", [["load_aoi", "Load AOI"], ["load_imagery", "Load imagery"], ["cloud_mask", "Mask cloud"], ["vegetation_index", "Vegetation index"], ["land_cover", "Land cover"], ["carbon_model", "Carbon model"], ["zonal_statistics", "Zonal statistics"], ["export_report", "Export report"]]),
  make("Crop monitoring", "crop", "Monitor field health over time.", [["load_field_boundary", "Load field"], ["load_multitemporal_imagery", "Multitemporal imagery"], ["cloud_mask", "Mask cloud"], ["ndvi", "NDVI"], ["change_detection", "Change detection"], ["time_series", "Time series"], ["export", "Export"]]),
  make("Disaster monitoring", "disaster", "Compare before and after imagery for rapid assessment.", [["load_aoi", "Load AOI"], ["load_before_imagery", "Before imagery"], ["load_after_imagery", "After imagery"], ["change_detection", "Change detection"], ["severity_classification", "Severity"], ["hotspot_3d", "3D hotspots"], ["export_map", "Export map"]]),
];

export const NODE_CATALOG = [
  ["Inputs", [["load_aoi", "Load AOI"], ["load_raster", "Load raster"], ["load_imagery", "Load imagery"], ["load_dem", "Load DEM"]]],
  ["Analysis", [["clip", "Clip"], ["cloud_mask", "Mask cloud"], ["ndvi", "NDVI"], ["evi", "EVI"], ["ndwi", "NDWI"], ["savi", "SAVI"], ["band_math", "Band math"], ["reclassify", "Reclassify"], ["change_detection", "Change detection"], ["classification", "Classification"], ["zonal_statistics", "Zonal statistics"], ["slope", "Slope"], ["aspect", "Aspect"], ["hillshade", "Hillshade"]]],
  ["Outputs", [["histogram", "Histogram"], ["raster_statistics", "Raster statistics"], ["export_geotiff", "Export GeoTIFF"], ["export_cog", "Export COG"], ["export_geojson", "Export GeoJSON"], ["export_report", "Export report"], ["add_map_layer", "Add map layer"], ["add_3d_layer", "Add 3D layer"]]],
] as const;
