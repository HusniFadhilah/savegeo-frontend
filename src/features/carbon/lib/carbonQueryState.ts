export type CarbonMode = "carbon" | "vegetation" | "landcover" | "landcover_change";
export interface CarbonQueryState {
  mode: CarbonMode;
  aoiId?: number; aoiSource?: string; aoiName?: string; aoiGeoJson?: string;
  dataset?: string; satellite?: string; tool?: string; index?: string; year?: number;
  yearFrom?: number; yearTo?: number; monthFrom?: number; monthTo?: number;
  startDate?: string; endDate?: string; cloudThreshold?: number; cloudMask?: string;
  dwProbabilityThreshold?: number; scale?: number; clipMode?: string; model?: string;
  referenceDataset?: string; activeLayer?: string; compareLayer?: string;
  view?: "single" | "split" | "swipe"; orientation?: "vertical" | "horizontal";
  opacity?: number; basemap?: string; showReference?: boolean; changeMode?: string;
}
const modes = new Set<CarbonMode>(["carbon", "vegetation", "landcover", "landcover_change"]);
const num = (v: string | null, min?: number, max?: number) => { if (v == null || v === "") return undefined; const n = Number(v); return Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max) ? n : undefined; };
const bool = (v: string | null) => v == null ? undefined : v === "true" || v === "1";
export function parseCarbonQuery(search: string): CarbonQueryState {
  const q = new URLSearchParams(search); const mode = modes.has(q.get("mode") as CarbonMode) ? q.get("mode") as CarbonMode : "carbon";
  return { mode, aoiId: num(q.get("aoi_id"), 1), aoiSource: q.get("aoi_source") || undefined, aoiName: q.get("aoi_name") || undefined, aoiGeoJson: q.get("aoi_geojson") || undefined,
    dataset:q.get("dataset")||undefined, satellite:q.get("satellite")||undefined, tool:q.get("tool")||undefined, index:q.get("index")||undefined, year:num(q.get("year"),1900,2200), yearFrom:num(q.get("year_from")||q.get("start_year"),1900,2200), yearTo:num(q.get("year_to")||q.get("end_year"),1900,2200), monthFrom:num(q.get("month_from"),1,12), monthTo:num(q.get("month_to"),1,12), startDate:q.get("start_date")||q.get("date")||undefined, endDate:q.get("end_date")||undefined, cloudThreshold:num(q.get("cloud")||q.get("cloud_threshold"),0,100), cloudMask:q.get("cloud_mask")||undefined, dwProbabilityThreshold:num(q.get("dw_probability_threshold"),0,1), scale:num(q.get("scale"),0.01), clipMode:q.get("clip")||q.get("clip_to_aoi")||undefined, model:q.get("model")||undefined, referenceDataset:q.get("reference_dataset")||undefined, activeLayer:q.get("active_layer")||undefined, compareLayer:q.get("compare")||undefined, view:(q.get("view") === "split" ? "split" : q.get("view") === "swipe" ? "swipe" : q.has("view") ? "single" : undefined), orientation:q.get("orientation") === "horizontal" ? "horizontal" : q.get("orientation") === "vertical" ? "vertical" : undefined, opacity:num(q.get("opacity"),0,1), basemap:q.get("basemap")||undefined, showReference:bool(q.get("show_reference")), changeMode:q.get("change_mode")||undefined };
}
export function serializeCarbonQuery(s: CarbonQueryState): URLSearchParams { const q = new URLSearchParams(); const put=(k:string,v:unknown)=>{if(v!==undefined&&v!==null&&v!=="")q.set(k,String(v));}; put("mode",s.mode); put("aoi_id",s.aoiId); put("aoi_source",s.aoiSource); put("aoi_name",s.aoiName); put("aoi_geojson",s.aoiGeoJson); put("dataset",s.dataset); put("satellite",s.satellite); put("tool",s.tool); put("index",s.index); put("year",s.year); put("year_from",s.yearFrom); put("year_to",s.yearTo); put("month_from",s.monthFrom); put("month_to",s.monthTo); put("start_date",s.startDate); put("end_date",s.endDate); put("cloud",s.cloudThreshold); put("cloud_mask",s.cloudMask); put("dw_probability_threshold",s.dwProbabilityThreshold); put("scale",s.scale); put("clip",s.clipMode); put("model",s.model); put("reference_dataset",s.referenceDataset); put("active_layer",s.activeLayer); put("compare",s.compareLayer); put("view",s.view); put("orientation",s.orientation); put("opacity",s.opacity); put("basemap",s.basemap); if(s.showReference!==undefined)put("show_reference",s.showReference); put("change_mode",s.changeMode); return q; }
export function buildCarbonQueryUrl(state: CarbonQueryState): string { return `/carbon-estimation?${serializeCarbonQuery(state).toString()}`; }

