import type { FirmsPeriod, FirmsQueryState, FirmsSourceId } from "../types";

export const DEFAULT_FIRMS_QUERY: FirmsQueryState = {
  enabled: false,
  source: "all",
  period: "1",
  historicalDate: "",
  minConfidence: 0,
  minFrp: "",
  showLabels: false,
  cluster: true,
  dayOnly: false,
  highOnly: false,
};

const SOURCES = new Set<FirmsSourceId>([
  "all",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "VIIRS_SNPP_NRT",
  "MODIS_NRT",
  "LANDSAT_NRT",
]);
const PERIODS = new Set<FirmsPeriod>(["1", "2", "3", "7", "historical"]);

function boolParam(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const value = params.get(key);
  return value === null ? fallback : value === "1";
}

export function parseFirmsQuery(search: string): FirmsQueryState {
  const params = new URLSearchParams(search);
  const source = params.get("firmsSource") as FirmsSourceId | null;
  const period = params.get("firmsDays") as FirmsPeriod | null;
  const confidence = Number(params.get("firmsConfidence"));
  const validConfidence = Number.isFinite(confidence) && confidence >= 0 && confidence <= 100;
  const minFrp = params.get("firmsMinFrp") ?? "";
  return {
    enabled: params.get("firms") === "1",
    source: source && SOURCES.has(source) ? source : DEFAULT_FIRMS_QUERY.source,
    period: period && PERIODS.has(period) ? period : DEFAULT_FIRMS_QUERY.period,
    historicalDate: params.get("firmsDate") ?? DEFAULT_FIRMS_QUERY.historicalDate,
    minConfidence: validConfidence ? confidence : DEFAULT_FIRMS_QUERY.minConfidence,
    minFrp: /^\d+(\.\d+)?$/.test(minFrp) ? minFrp : DEFAULT_FIRMS_QUERY.minFrp,
    showLabels: boolParam(params, "firmsLabels", DEFAULT_FIRMS_QUERY.showLabels),
    cluster: boolParam(params, "firmsCluster", DEFAULT_FIRMS_QUERY.cluster),
    dayOnly: boolParam(params, "firmsDay", DEFAULT_FIRMS_QUERY.dayOnly),
    highOnly: boolParam(params, "firmsHigh", DEFAULT_FIRMS_QUERY.highOnly),
  };
}

export function writeFirmsQuery(params: URLSearchParams, state: FirmsQueryState): URLSearchParams {
  const next = new URLSearchParams(params);
  const values: Record<string, string | null> = {
    firms: state.enabled ? "1" : null,
    firmsSource: state.source === "all" ? null : state.source,
    firmsDays: state.period === "1" ? null : state.period,
    firmsDate: state.period === "historical" && state.historicalDate ? state.historicalDate : null,
    firmsConfidence: state.minConfidence > 0 ? String(state.minConfidence) : null,
    firmsMinFrp: state.minFrp || null,
    firmsLabels: state.showLabels ? "1" : null,
    firmsCluster: state.cluster === DEFAULT_FIRMS_QUERY.cluster ? null : "0",
    firmsDay: state.dayOnly ? "1" : null,
    firmsHigh: state.highOnly ? "1" : null,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}
