import type { SubAnalysisKey, WeatherProvider } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  sentinel1Enabled: boolean;
  onSentinel1Change: (v: boolean) => void;
  sentinel2Enabled: boolean;
  onSentinel2Change: (v: boolean) => void;
  weatherProviders: Record<string, WeatherProvider>;
  weatherSource: string;
  onWeatherSourceChange: (v: string) => void;
  subAnalyses: SubAnalysisKey[];
  onSubAnalysesChange: (keys: SubAnalysisKey[]) => void;
}

const SUB_ANALYSIS_OPTIONS: { key: SubAnalysisKey; labelKey: string; extra?: boolean }[] = [
  { key: "health", labelKey: "crop.sub.health" },
  { key: "timeseries", labelKey: "crop.sub.timeseries" },
  { key: "anomaly", labelKey: "crop.sub.anomaly" },
  { key: "growth_stage", labelKey: "crop.sub.growthStage" },
  { key: "water_moisture", labelKey: "crop.sub.moisture" },
  { key: "weather", labelKey: "crop.sub.weather" },
  { key: "flood", labelKey: "crop.sub.flood", extra: true },
  { key: "productivity_zones", labelKey: "crop.sub.productivity" },
  { key: "historical_comparison", labelKey: "crop.sub.historical", extra: true },
  { key: "risk_score", labelKey: "crop.sub.risk" },
];

/**
 * Sentinel-1/2 checkboxes (informational + gates data_sources.sentinel1 for
 * Productivity Zones), weather-provider select, sub-analyses checklist.
 * "flood"/"historical_comparison" default unchecked - they need extra
 * params the backend never auto-includes them without.
 */
export default function DataSourceTogglesPanel({
  sentinel1Enabled,
  onSentinel1Change,
  sentinel2Enabled,
  onSentinel2Change,
  weatherProviders,
  weatherSource,
  onWeatherSourceChange,
  subAnalyses,
  onSubAnalysesChange,
}: Props) {
  const t = useI18nStore((state) => state.t);
  function toggleSub(key: SubAnalysisKey, checked: boolean) {
    if (checked) {
      if (!subAnalyses.includes(key)) onSubAnalysesChange([...subAnalyses, key]);
    } else {
      onSubAnalysesChange(subAnalyses.filter((k) => k !== key));
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-sliders me-1" /> {t("crop.sources.title")}
      </div>
      <div className="card-body">
        <label className="form-label">{t("crop.sources.imagery")}</label>
        <div className="form-check">
          <input
            id="cmSentinel2"
            className="form-check-input"
            type="checkbox"
            checked={sentinel2Enabled}
            onChange={(e) => onSentinel2Change(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="cmSentinel2">
            {t("crop.sources.sentinel2")}
          </label>
        </div>
        <div className="form-check mb-3">
          <input
            id="cmSentinel1"
            className="form-check-input"
            type="checkbox"
            checked={sentinel1Enabled}
            onChange={(e) => onSentinel1Change(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="cmSentinel1">
            {t("crop.sources.sentinel1")}
          </label>
        </div>

        <div className="mb-3">
          <label className="form-label">{t("crop.sources.weather")}</label>
          <select className="form-select form-select-sm" value={weatherSource} onChange={(e) => onWeatherSourceChange(e.target.value)}>
            {Object.entries(weatherProviders).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <label className="form-label">{t("crop.sources.subAnalyses")}</label>
        {SUB_ANALYSIS_OPTIONS.map((opt) => (
          <div className="form-check" key={opt.key}>
            <input
              id={`cmSub_${opt.key}`}
              className="form-check-input"
              type="checkbox"
              checked={subAnalyses.includes(opt.key)}
              onChange={(e) => toggleSub(opt.key, e.target.checked)}
            />
            <label className="form-check-label small" htmlFor={`cmSub_${opt.key}`}>
              {t(opt.labelKey)}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
