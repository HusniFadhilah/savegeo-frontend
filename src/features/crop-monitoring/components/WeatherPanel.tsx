import CropPanelAccordion from "./CropPanelAccordion";
import { fmtNum, localizeCropMessage, localizeCropReason } from "../utils";
import type { WeatherResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";
import "./weather-panel.css";

interface Props {
  weather: WeatherResult;
}

/** Sub-analysis F: weather stat tiles + warning banners. */
export default function WeatherPanel({ weather }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <CropPanelAccordion title={t("crop.card.weatherTitle")} icon="bi-cloud-rain-fill">
      {!weather.available ? (
        <div className="alert alert-secondary py-2 mb-0 small">
          {t("crop.unavailable")}{localizeCropReason(weather.reason, t) ? `: ${localizeCropReason(weather.reason, t)}` : "."}
        </div>
      ) : (
        <>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-rain" aria-hidden="true"><i className="bi bi-cloud-rain-fill" /></span>
                <div className="cm-weather-stat__content"><strong>{fmtNum(weather.rainfall_mm_period, 1)} mm</strong><span>{t("crop.rainfallPeriod")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-normal" aria-hidden="true"><i className="bi bi-cloud-sun-fill" /></span>
                <div className="cm-weather-stat__content"><strong>{fmtNum(weather.rainfall_mm_historical_normal, 1)} mm</strong><span>{t("crop.historicalNormal")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-deficit" aria-hidden="true"><i className="bi bi-droplet-half" /></span>
                <div className="cm-weather-stat__content"><strong>{weather.rainfall_deficit_pct != null ? `${fmtNum(weather.rainfall_deficit_pct, 1)}%` : "-"}</strong><span>{t("crop.rainfallDeficit")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-dry" aria-hidden="true"><i className="bi bi-sun-fill" /></span>
                <div className="cm-weather-stat__content"><strong>{weather.dry_days}</strong><span>{t("crop.dryDays")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-hot" aria-hidden="true"><i className="bi bi-thermometer-high" /></span>
                <div className="cm-weather-stat__content"><strong>{fmtNum(weather.tmax, 1)}°C</strong><span>{t("crop.maxTemperature")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-cool" aria-hidden="true"><i className="bi bi-thermometer-low" /></span>
                <div className="cm-weather-stat__content"><strong>{fmtNum(weather.tmin, 1)}°C</strong><span>{t("crop.minTemperature")}</span></div>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="cm-weather-stat">
                <span className="cm-weather-stat__icon is-humidity" aria-hidden="true"><i className="bi bi-droplet-fill" /></span>
                <div className="cm-weather-stat__content"><strong>{weather.humidity != null ? `${fmtNum(weather.humidity, 0)}%` : "-"}</strong><span>{t("crop.humidity")}</span></div>
              </div>
            </div>
          </div>
          <small className="text-muted d-block">
            {t("crop.source")}: {weather.source === "gee" ? "Google Earth Engine" : "Open-Meteo"} · {weather.period.start} – {weather.period.end}
            {weather.data_quality.images_used != null && ` · ${weather.data_quality.images_used} ${t("crop.images")}`}
          </small>
          {weather.data_quality.note && <small className="text-muted d-block">{localizeCropMessage(weather.data_quality.note, t)}</small>}
          {weather.warnings.length > 0 && (
            <div className="mt-2">
              {weather.warnings.map((w, i) => (
                <div key={i} className={`alert alert-${w.level === "warning" ? "warning" : "info"} py-2 mb-1 small`}>
                  <i className="bi bi-exclamation-triangle me-1" /> {localizeCropMessage(w.message, t)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CropPanelAccordion>
  );
}
