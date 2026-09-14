import { useEffect, useState } from "react";
import { GeoJSON, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools from "@/components/map/AoiDrawingTools";
import MapLegend from "@/components/map/MapLegend";
import { ApiError } from "@/services/apiClient";
import type { AoiFeature } from "@/types/map";
import { RESULT_PANE } from "@/config/mapPanes";
import { analyzeDemSlope, fetchBmkgAlerts, fetchDisasterSources } from "./api";
import type { BmkgAlert, DemSlopeResult, DisasterSourcesMap } from "./types";
import { toAoiPayload } from "./utils";
import AoiStatusCard from "./components/AoiStatusCard";
import SourceStatusPanel from "./components/SourceStatusPanel";
import BmkgAlerts from "./components/BmkgAlerts";
import DemSlopeControls from "./components/DemSlopeControls";

const SOURCE_OPACITY: Record<string, number> = {
  inarisk: 0.62,
  demnas: 0.48,
};

function FitToAoi({ aoi }: { aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as unknown as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi]);
  return null;
}

/**
 * Legacy "Additional Sources" module-tab entry point - still wired into
 * `pages/DashboardPage.tsx`'s module-tab system (`disaster` key), which is
 * out of this feature's file boundary and left untouched, so this component
 * must keep existing as the default export of this file.
 *
 * The full Disaster Intelligence Dashboard redesign now lives at the
 * dedicated `/pemetaan-bencana` route (`DisasterListPage.tsx` /
 * `DisasterDashboard.tsx`), which is now the home for the complete
 * per-event workflow. The 2026 Kalimantan fire panel uses the restored
 * `analyzeDisasterEvent` / `POST /disaster/event-map` flow for on-demand
 * dNBR, imagery, area, and hotspot analysis. What's left here is the 3
 * still-standalone sub-features (official
 * source status, BMKG alerts, DEM/slope) against a locally-drawn AOI, now
 * calling the same `/disaster/*` endpoints as user-authenticated requests
 * (see `api.ts` - the backend now gates them behind `get_current_user`).
 */
export default function DisasterModule() {
  const [aoi, setAoi] = useState<AoiFeature | null>(null);

  const [sources, setSources] = useState<DisasterSourcesMap | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<BmkgAlert[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [demResult, setDemResult] = useState<DemSlopeResult | null>(null);
  const [demLoading, setDemLoading] = useState(false);
  const [demError, setDemError] = useState<string | null>(null);

  function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    return fallback;
  }

  async function handleLoadSources() {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const res = await fetchDisasterSources();
      setSources(res);
    } catch (err) {
      setSourcesError(errorMessage(err, "Terjadi kesalahan jaringan saat memuat sumber resmi."));
    } finally {
      setSourcesLoading(false);
    }
  }

  async function handleLoadBmkg() {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await fetchBmkgAlerts(20);
      setAlerts(res.alerts ?? []);
    } catch (err) {
      setAlertsError(errorMessage(err, "Terjadi kesalahan jaringan saat memuat peringatan BMKG."));
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleLoadDem() {
    if (!aoi) {
      setDemError("Gambar AOI (poligon/kotak) di peta sebelum memuat DEM.");
      return;
    }
    setDemLoading(true);
    setDemError(null);
    try {
      const res = await analyzeDemSlope({ aoi: toAoiPayload(aoi), scale: 90 });
      setDemResult(res);
    } catch (err) {
      setDemError(errorMessage(err, "Terjadi kesalahan jaringan saat memuat DEM."));
    } finally {
      setDemLoading(false);
    }
  }

  const anyLoading = sourcesLoading || alertsLoading || demLoading;
  const configuredSources = sources ? Object.values(sources).filter((item) => item.configured).length : 0;

  return (
    <div className="analysis-page analysis-page-disaster">
      <section className="analysis-hero analysis-hero-disaster" aria-labelledby="disasterHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">Pemetaan Bencana</span>
          <h1 id="disasterHeroTitle">Pemetaan Risiko Bencana & Sumber Resmi</h1>
          <p>
            Gabungkan AOI, peringatan BMKG, sumber resmi, dan layer kemiringan DEM untuk membaca konteks risiko wilayah
            secara cepat.
          </p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-bounding-box" />
            <div>
              <span>AOI</span>
              <strong>{aoi ? aoi.geometry.type : "Belum digambar"}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-database-check" />
            <div>
              <span>Sumber</span>
              <strong>{sources ? `${configuredSources} aktif` : "Belum dimuat"}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-cloud-lightning-rain" />
            <div>
              <span>BMKG</span>
              <strong>{alerts ? `${alerts.length} alert` : "Belum dimuat"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-lg-3">
        <div className="sidebar h-100">
          <h5 className="mb-3">
            <i className="bi bi-sliders" /> Sumber Tambahan
          </h5>
          <AoiStatusCard aoi={aoi} />
          <button
            className="btn btn-outline-primary w-100 mt-2"
            onClick={handleLoadSources}
            disabled={anyLoading}
          >
            <i className="bi bi-database-fill" /> Muat Sumber Resmi
          </button>
          <button className="btn btn-outline-info w-100 mt-2" onClick={handleLoadBmkg} disabled={anyLoading}>
            <i className="bi bi-cloud-rain-heavy-fill" /> Peringatan BMKG
          </button>
          <button className="btn btn-outline-secondary w-100 mt-2" onClick={handleLoadDem} disabled={anyLoading}>
            <i className="bi bi-triangle-fill" /> Layer Kemiringan DEM
          </button>
          <div className="alert alert-secondary py-2 mt-3 mb-0" style={{ fontSize: ".78rem" }}>
            Untuk dashboard intelijen bencana lengkap (analisis per-kejadian, statistik, hotspot), buka{" "}
            <strong>Pemetaan Bencana</strong> di <code>/pemetaan-bencana</code>.
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        <SourceStatusPanel loading={sourcesLoading} error={sourcesError} sources={sources} />
        <BmkgAlerts loading={alertsLoading} error={alertsError} alerts={alerts} />
        <DemSlopeControls loading={demLoading} error={demError} result={demResult} />

        <MapView id="disasterMap" center={[-6.9667, 110.4167]} zoom={9}>
          <BasemapSwitcher />
          <AoiDrawingTools onChange={setAoi} />

          {aoi && (
            <GeoJSON
              key={JSON.stringify(aoi.geometry)}
              data={aoi as unknown as GeoJSON.Feature}
              style={{ color: "#1565c0", weight: 2, fill: false }}
            />
          )}

          {sources &&
            Object.entries(sources).map(([key, item]) => {
              if (!item.configured) return null;
              const opacity = SOURCE_OPACITY[key] ?? 0.55;
              if (item.tile_url) {
                return <TileLayer key={key} url={item.tile_url} opacity={opacity} attribution={item.name} pane={RESULT_PANE} />;
              }
              if (item.wms_url && item.layers) {
                return (
                  <WMSTileLayer
                    key={key}
                    url={item.wms_url}
                    layers={item.layers}
                    format="image/png"
                    transparent
                    opacity={opacity}
                    attribution={item.name}
                    pane={RESULT_PANE}
                  />
                );
              }
              return null;
            })}

          {demResult?.tile_url && (
            <TileLayer
              url={demResult.tile_url}
              opacity={0.58}
              attribution={demResult.is_official_demnas ? "BIG DEMNAS" : "USGS SRTM fallback"}
              pane={RESULT_PANE}
            />
          )}

          <FitToAoi aoi={aoi} />
        </MapView>
        <div className="mt-2">
          <MapLegend entries={demResult?.legend ?? []} />
        </div>
        </div>
      </div>
    </div>
  );
}
