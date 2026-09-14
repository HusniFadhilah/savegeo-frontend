import { parseModuleQuery, serializeModuleQuery, updateModuleUrl, buildModuleShareUrl, type ModuleQueryState } from "@/lib/moduleQueryState";
export type CropMonitoringQueryState = ModuleQueryState;
export const parseQuery = parseModuleQuery;
export const serializeQuery = serializeModuleQuery;
export const applyQueryState = (_: CropMonitoringQueryState) => undefined;
export const updateUrlFromState = (s: CropMonitoringQueryState) => updateModuleUrl("/crop-monitoring", s);
export const buildShareUrl = (s: CropMonitoringQueryState) => buildModuleShareUrl("/crop-monitoring", s);
