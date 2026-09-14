import { parseModuleQuery, serializeModuleQuery, updateModuleUrl, buildModuleShareUrl, type ModuleQueryState } from "@/lib/moduleQueryState";
export type LcChangeQueryState = ModuleQueryState;
export const parseQuery = parseModuleQuery;
export const serializeQuery = serializeModuleQuery;
export const applyQueryState = (_: LcChangeQueryState) => undefined;
export const updateUrlFromState = (s: LcChangeQueryState) => updateModuleUrl("/land-cover-change", s);
export const buildShareUrl = (s: LcChangeQueryState) => buildModuleShareUrl("/land-cover-change", s);
