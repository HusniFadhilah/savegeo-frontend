import type { SubAnalysisKey, WeatherProvider } from "../types";

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

const SUB_ANALYSIS_OPTIONS: { key: SubAnalysisKey; label: string; extra?: boolean }[] = [
  { key: "health", label: "A. Kesehatan Tanaman (NDVI)" },
  { key: "timeseries", label: "B. Time-Series Vegetasi" },
  { key: "anomaly", label: "C. Deteksi Anomali" },
  { key: "growth_stage", label: "D. Fase Pertumbuhan" },
  { key: "water_moisture", label: "E. Kelembaban Air (NDMI)" },
  { key: "weather", label: "F. Cuaca" },
  { key: "flood", label: "G. Dampak Banjir (butuh tanggal pre/post)", extra: true },
  { key: "productivity_zones", label: "H. Zona Produktivitas" },
  { key: "historical_comparison", label: "I. Perbandingan Historis", extra: true },
  { key: "risk_score", label: "J. Skor Risiko" },
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
        <i className="bi bi-sliders me-1" /> Sumber Data &amp; Sub-Analisis
      </div>
      <div className="card-body">
        <label className="form-label">Citra Satelit</label>
        <div className="form-check">
          <input
            id="cmSentinel2"
            className="form-check-input"
            type="checkbox"
            checked={sentinel2Enabled}
            onChange={(e) => onSentinel2Change(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="cmSentinel2">
            Sentinel-2 (optik, wajib untuk sebagian besar sub-analisis)
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
            Sentinel-1 (radar, dipakai Zona Produktivitas jika aktif)
          </label>
        </div>

        <div className="mb-3">
          <label className="form-label">Sumber Data Cuaca</label>
          <select className="form-select form-select-sm" value={weatherSource} onChange={(e) => onWeatherSourceChange(e.target.value)}>
            {Object.entries(weatherProviders).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <label className="form-label">Sub-Analisis yang Dijalankan</label>
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
              {opt.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
