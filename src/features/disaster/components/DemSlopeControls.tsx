import type { DemSlopeResult } from "../types";

interface Props {
  loading: boolean;
  error: string | null;
  result: DemSlopeResult | null;
}

/**
 * Status readout for DisasterMapping.loadDemSlope() (main.js ~L5367-5399).
 * The DEM/slope tile layer itself is added to the map by DisasterEventMap;
 * this panel just shows the stats + configured/fallback banner.
 */
export default function DemSlopeControls({ loading, error, result }: Props) {
  if (loading) {
    return (
      <div className="alert alert-info py-2 mb-3">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Menghitung kemiringan lereng dari DEM...
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger py-2 mb-3">{error}</div>;
  }

  if (!result) return null;

  return (
    <div className={`alert ${result.is_official_demnas ? "alert-success" : "alert-warning"} py-2 mb-3`}>
      <strong>Layer kemiringan lereng aktif.</strong> Sumber: {result.source}. Rata-rata:{" "}
      {Number(result.stats?.mean_slope_deg || 0).toFixed(1)}°, Maksimum:{" "}
      {Number(result.stats?.max_slope_deg || 0).toFixed(1)}°.
      {!result.is_official_demnas && (
        <div className="small mt-1">DEMNAS belum dikonfigurasi; layer ini memakai fallback DEM global.</div>
      )}
    </div>
  );
}
