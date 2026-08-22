import type { CropMonitoringPeriodMode } from "../types";

interface Props {
  mode: CropMonitoringPeriodMode;
  onModeChange: (mode: CropMonitoringPeriodMode) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  compareSeasonEnabled: boolean;
  onCompareSeasonChange: (v: boolean) => void;
  compareYears: number[];
  onCompareYearsChange: (years: number[]) => void;
}

const MODE_OPTIONS: { value: CropMonitoringPeriodMode; label: string }[] = [
  { value: "current_season", label: "Musim Berjalan" },
  { value: "30d", label: "30 Hari Terakhir" },
  { value: "90d", label: "90 Hari Terakhir" },
  { value: "custom", label: "Kustom" },
];

export default function MonitoringPeriodPanel({
  mode,
  onModeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  compareSeasonEnabled,
  onCompareSeasonChange,
  compareYears,
  onCompareYearsChange,
}: Props) {
  function setCompareYear(index: number, value: number) {
    const next = [...compareYears];
    next[index] = value;
    onCompareYearsChange(next);
  }

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-calendar-range me-1" /> Periode Pemantauan
      </div>
      <div className="card-body">
        <div className="mb-2">
          <label className="form-label">Mode Periode</label>
          <select className="form-select form-select-sm" value={mode} onChange={(e) => onModeChange(e.target.value as CropMonitoringPeriodMode)}>
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {mode === "custom" && (
          <div className="d-flex gap-2 mb-2">
            <div className="flex-grow-1">
              <label className="form-label small">Mulai</label>
              <input type="date" className="form-control form-control-sm" value={customStart} onChange={(e) => onCustomStartChange(e.target.value)} />
            </div>
            <div className="flex-grow-1">
              <label className="form-label small">Akhir</label>
              <input type="date" className="form-control form-control-sm" value={customEnd} onChange={(e) => onCustomEndChange(e.target.value)} />
            </div>
          </div>
        )}

        <div className="form-check form-switch mt-3">
          <input
            id="cmCompareSeason"
            className="form-check-input"
            type="checkbox"
            checked={compareSeasonEnabled}
            onChange={(e) => onCompareSeasonChange(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="cmCompareSeason">
            <i className="bi bi-bar-chart-steps me-1" /> Bandingkan Musim (Historical Comparison)
          </label>
        </div>

        {compareSeasonEnabled && (
          <div className="mt-2">
            <label className="form-label small">Tahun Pembanding</label>
            <div className="d-flex gap-2">
              {compareYears.map((year, i) => (
                <input
                  key={i}
                  type="number"
                  className="form-control form-control-sm"
                  value={year}
                  onChange={(e) => setCompareYear(i, Number(e.target.value))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
