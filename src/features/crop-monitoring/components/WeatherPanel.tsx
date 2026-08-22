import { fmtNum } from "../utils";
import type { WeatherResult } from "../types";

interface Props {
  weather: WeatherResult;
}

/** Sub-analysis F: weather stat tiles + warning banners. */
export default function WeatherPanel({ weather }: Props) {
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-cloud-rain-fill me-1" /> F. Cuaca
      </div>
      <div className="card-body">
        {!weather.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            Tidak tersedia{weather.reason ? `: ${weather.reason}` : "."}
          </div>
        ) : (
          <>
            <div className="row g-2 text-center mb-2">
              <div className="col-6 col-md-3">
                <div className="fw-bold">{fmtNum(weather.rainfall_mm_period, 1)} mm</div>
                <div className="small text-muted">Curah Hujan Periode</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="fw-bold">{fmtNum(weather.rainfall_mm_historical_normal, 1)} mm</div>
                <div className="small text-muted">Normal Historis</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="fw-bold">{weather.rainfall_deficit_pct != null ? `${fmtNum(weather.rainfall_deficit_pct, 1)}%` : "-"}</div>
                <div className="small text-muted">Defisit Hujan</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="fw-bold">{weather.dry_days}</div>
                <div className="small text-muted">Hari Kering</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="fw-bold">{fmtNum(weather.tmax, 1)}°C</div>
                <div className="small text-muted">Suhu Maks</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="fw-bold">{fmtNum(weather.tmin, 1)}°C</div>
                <div className="small text-muted">Suhu Min</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="fw-bold">{weather.humidity != null ? `${fmtNum(weather.humidity, 0)}%` : "-"}</div>
                <div className="small text-muted">Kelembaban</div>
              </div>
            </div>
            <small className="text-muted d-block">
              Sumber: {weather.source === "gee" ? "Google Earth Engine" : "Open-Meteo"} · {weather.period.start} – {weather.period.end}
              {weather.data_quality.images_used != null && ` · ${weather.data_quality.images_used} citra`}
            </small>
            {weather.data_quality.note && <small className="text-muted d-block">{weather.data_quality.note}</small>}
            {weather.warnings.length > 0 && (
              <div className="mt-2">
                {weather.warnings.map((w, i) => (
                  <div key={i} className={`alert alert-${w.level === "warning" ? "warning" : "info"} py-2 mb-1 small`}>
                    <i className="bi bi-exclamation-triangle me-1" /> {w.message}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
