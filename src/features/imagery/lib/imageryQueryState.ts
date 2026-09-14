import { parseModuleQuery, serializeModuleQuery, updateModuleUrl, buildModuleShareUrl, type ModuleQueryState } from "@/lib/moduleQueryState";
export type ImageryQueryState = ModuleQueryState;
export const parseQuery = parseModuleQuery;
export const serializeQuery = serializeModuleQuery;
export const applyQueryState = (_: ImageryQueryState) => undefined;
export const updateUrlFromState = (s: ImageryQueryState) => updateModuleUrl("/satellite-imagery", s);
export const buildShareUrl = (s: ImageryQueryState) => buildModuleShareUrl("/satellite-imagery", s);
