import type { CarbonResult } from "@/features/carbon/types";

interface Props {
  result: CarbonResult;
}

/** Ported from main.js displayCarbonStats(): density/total tables + model performance. */
export default function CarbonStatsPanel({ result }: Props) {
  const stats = result.carbon_estimated?.statistics || {};
  const areaInfo = result.area_info || {};
  const modelInfo = result.model_info || {};
  const reference = result.carbon_reference;
  const perf = result.model_performance;

  const calculationAreaHa = areaInfo.calculation_area_ha ?? areaInfo.area_ha ?? 0;
  const isClipped = modelInfo.calculation_mode === "clipped_aoi";

  return (
    <div className="mt-4">
      <h5 className="mb-3">
        <i className="bi bi-tree me-1" /> Analisis Stok Karbon
      </h5>

      <div className={`alert ${isClipped ? "alert-success" : "alert-info"} mb-3`}>
        <div className="row">
          <div className="col-md-6">
            <i className={`bi ${isClipped ? "bi-scissors" : "bi-layers"} me-1`} />
            <strong>{isClipped ? "Mode Clipped" : "Mode Bounding Box"}</strong>
            <br />
            <small>
              <i className="bi bi-info-circle me-1" />
              Luas: {calculationAreaHa.toLocaleString()} ha
              {areaInfo.description ? <><br />{areaInfo.description}</> : null}
            </small>
          </div>
          {reference && (
            <div className="col-md-6">
              <strong>
                <i className="bi bi-database me-1" /> Dataset Referensi
              </strong>
              <br />
              <small>
                {reference.name || reference.full_name || "N/A"} ({reference.year ?? "N/A"})
                <br />
                Resolusi: {reference.resolution ? `${reference.resolution}m` : "N/A"}
              </small>
            </div>
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Statistik Densitas Karbon</h6>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td>Mean</td>
                    <td>{(stats.mean ?? 0).toFixed(2)} Mg/ha</td>
                  </tr>
                  <tr>
                    <td>Std Dev</td>
                    <td>{(stats.std_dev ?? 0).toFixed(2)} Mg/ha</td>
                  </tr>
                  <tr>
                    <td>Min</td>
                    <td>{(stats.min ?? 0).toFixed(2)} Mg/ha</td>
                  </tr>
                  <tr>
                    <td>Max</td>
                    <td>{(stats.max ?? 0).toFixed(2)} Mg/ha</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Total Stok Karbon</h6>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td>Luas Perhitungan</td>
                    <td>{calculationAreaHa.toLocaleString()} ha</td>
                  </tr>
                  <tr>
                    <td>Total Karbon</td>
                    <td>{(areaInfo.total_carbon_tons ?? 0).toLocaleString()} ton</td>
                  </tr>
                  <tr>
                    <td>Setara CO2</td>
                    <td>{(areaInfo.carbon_dioxide_equivalent_tons ?? 0).toLocaleString()} ton CO2e</td>
                  </tr>
                  <tr>
                    <td>Model</td>
                    <td>{modelInfo.model_name || "N/A"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {perf && (
        <div className="row mt-3">
          <div className="col-md-12">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Performa Model</h6>
                <div className="d-flex flex-wrap gap-3">
                  {perf.r2_score !== undefined && (
                    <span>
                      R²: <strong>{perf.r2_score.toFixed(3)}</strong>
                    </span>
                  )}
                  {perf.rmse !== undefined && (
                    <span>
                      RMSE: <strong>{perf.rmse.toFixed(2)} Mg/ha</strong>
                      {perf.rmse_std ? ` ± ${perf.rmse_std.toFixed(2)}` : ""}
                    </span>
                  )}
                  {perf.cv_folds !== undefined && (
                    <span>
                      CV Folds: <strong>{perf.cv_folds}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
