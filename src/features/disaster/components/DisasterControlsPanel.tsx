import type { AoiFeature } from "@/types/map";
import { DISASTER_TYPE_OPTIONS, type DisasterType } from "../types";
import type { DisasterDateRange } from "../utils";
import AoiStatusCard from "./AoiStatusCard";

interface Props {
  aoi: AoiFeature | null;
  disasterType: DisasterType;
  onDisasterTypeChange: (value: DisasterType) => void;
  dates: DisasterDateRange;
  onDateChange: (field: keyof DisasterDateRange, value: string) => void;
  onRun: () => void;
  onLoadSources: () => void;
  onLoadBmkg: () => void;
  onLoadDem: () => void;
  runLoading: boolean;
  sourcesLoading: boolean;
  bmkgLoading: boolean;
  demLoading: boolean;
}

/** Sidebar form, ported from module-disaster.html's #disasterType/date inputs + action buttons. */
export default function DisasterControlsPanel({
  aoi,
  disasterType,
  onDisasterTypeChange,
  dates,
  onDateChange,
  onRun,
  onLoadSources,
  onLoadBmkg,
  onLoadDem,
  runLoading,
  sourcesLoading,
  bmkgLoading,
  demLoading,
}: Props) {
  const anyLoading = runLoading || sourcesLoading || bmkgLoading || demLoading;

  return (
    <div className="sidebar h-100">
      <h5 className="mb-3">
        <i className="bi bi-sliders" /> Pengaturan
      </h5>

      <AoiStatusCard aoi={aoi} />

      <div className="mb-3">
        <label className="form-label fw-bold" htmlFor="disasterType">
          Jenis Bencana
        </label>
        <select
          className="form-select"
          id="disasterType"
          value={disasterType}
          onChange={(e) => onDisasterTypeChange(e.target.value as DisasterType)}
        >
          {DISASTER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Periode Sebelum Kejadian</label>
        <input
          type="date"
          className="form-control form-control-sm mb-2"
          value={dates.beforeStart}
          onChange={(e) => onDateChange("beforeStart", e.target.value)}
        />
        <input
          type="date"
          className="form-control form-control-sm"
          value={dates.beforeEnd}
          onChange={(e) => onDateChange("beforeEnd", e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Periode Sesudah Kejadian</label>
        <input
          type="date"
          className="form-control form-control-sm mb-2"
          value={dates.afterStart}
          onChange={(e) => onDateChange("afterStart", e.target.value)}
        />
        <input
          type="date"
          className="form-control form-control-sm"
          value={dates.afterEnd}
          onChange={(e) => onDateChange("afterEnd", e.target.value)}
        />
        <small className="text-muted">Gunakan rentang setelah kejadian yang benar-benar terjadi.</small>
      </div>

      <button className="btn btn-success w-100 fw-bold" onClick={onRun} disabled={anyLoading}>
        <i className="bi bi-geo-alt-fill" /> Deteksi Area Terdampak
      </button>
      <button
        className="btn btn-outline-primary w-100 mt-2"
        onClick={onLoadSources}
        disabled={anyLoading}
      >
        <i className="bi bi-database-fill" /> Muat Sumber Resmi
      </button>
      <button className="btn btn-outline-info w-100 mt-2" onClick={onLoadBmkg} disabled={anyLoading}>
        <i className="bi bi-cloud-rain-heavy-fill" /> Peringatan BMKG
      </button>
      <button className="btn btn-outline-secondary w-100 mt-2" onClick={onLoadDem} disabled={anyLoading}>
        <i className="bi bi-triangle-fill" /> Layer Kemiringan DEM
      </button>
    </div>
  );
}
