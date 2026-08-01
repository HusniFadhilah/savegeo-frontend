import { useState } from "react";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools from "@/components/map/AoiDrawingTools";
import MapLegend from "@/components/map/MapLegend";
import { ApiError } from "@/services/apiClient";
import { useUiStore } from "@/hooks/useUiStore";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import { analyzeDemSlope, analyzeDisasterEvent, fetchBmkgAlerts, fetchDisasterSources } from "./api";
import type { BmkgAlert, DemSlopeResult, DisasterSourcesMap, DisasterType, EventMapResult } from "./types";
import { DISASTER_TYPE_LABELS } from "./types";
import { defaultDateRange, toAoiPayload, type DisasterDateRange } from "./utils";
import DisasterControlsPanel from "./components/DisasterControlsPanel";
import SourceStatusPanel from "./components/SourceStatusPanel";
import BmkgAlerts from "./components/BmkgAlerts";
import DemSlopeControls from "./components/DemSlopeControls";
import EventSummary from "./components/EventSummary";
import DisasterEventMap from "./components/DisasterEventMap";

/**
 * Disaster Mapping module. Ports frontend-nextjs2's DisasterMapping object
 * (main.js ~L4957-5410) and module-disaster.html. Four sub-features:
 *   1. Official source status (InaRISK/DEMNAS configured check)
 *   2. BMKG early-warning alerts
 *   3. DEM/slope layer
 *   4. Before/after event-map detection ("Deteksi Area Terdampak")
 *
 * Note: the legacy DisasterMapping object literal defined `run()` twice -
 * a client-side simulated grid-risk scorer (main.js ~L5072-5138) that was
 * immediately shadowed/overwritten by a second `async run()` calling
 * apiClient.analyzeDisasterEvent() (~L5176-5241), since JS keeps only the
 * last property in an object literal. Only the real (event-map) behavior
 * ever executed in production, so only that version is ported here.
 *
 * AOI: the legacy app read a global `currentAOI` set by the Carbon module.
 * This rebuild has no shared cross-module AOI store yet, so this module
 * draws its own AOI directly on its map via <AoiDrawingTools>.
 */
export default function DisasterModule() {
  const showLoading = useUiStore((s) => s.showLoading);
  const hideLoading = useUiStore((s) => s.hideLoading);

  const [aoi, setAoi] = useState<AoiFeature | null>(null);
  const [disasterType, setDisasterType] = useState<DisasterType>("flood");
  const [dates, setDates] = useState<DisasterDateRange>(() => defaultDateRange());

  const [sources, setSources] = useState<DisasterSourcesMap | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<BmkgAlert[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [demResult, setDemResult] = useState<DemSlopeResult | null>(null);
  const [demLoading, setDemLoading] = useState(false);
  const [demError, setDemError] = useState<string | null>(null);

  const [eventResult, setEventResult] = useState<EventMapResult | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const [legend, setLegend] = useState<MapLegendEntry[]>([]);
  const [fitSignal, setFitSignal] = useState(0);

  const handleDateChange = (field: keyof DisasterDateRange, value: string) => {
    setDates((prev) => ({ ...prev, [field]: value }));
  };

  function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return err.message;
    return fallback;
  }

  async function handleRun() {
    if (!aoi) {
      setEventError("Gambar AOI (poligon/kotak) di peta terlebih dahulu.");
      return;
    }
    setEventLoading(true);
    setEventError(null);
    showLoading(`Memproses citra sebelum/sesudah untuk ${DISASTER_TYPE_LABELS[disasterType]}...`, "Mohon tunggu");
    try {
      const res = await analyzeDisasterEvent({
        event_type: disasterType,
        aoi: toAoiPayload(aoi),
        before_start: dates.beforeStart,
        before_end: dates.beforeEnd,
        after_start: dates.afterStart,
        after_end: dates.afterEnd,
      });
      setEventResult(res);
      setLegend(res.legend ?? []);
      setFitSignal((n) => n + 1);
    } catch (err) {
      setEventError(errorMessage(err, "Terjadi kesalahan jaringan saat memproses deteksi area terdampak."));
    } finally {
      setEventLoading(false);
      hideLoading();
    }
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
      setLegend(res.legend ?? []);
    } catch (err) {
      setDemError(errorMessage(err, "Terjadi kesalahan jaringan saat memuat DEM."));
    } finally {
      setDemLoading(false);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <DisasterControlsPanel
          aoi={aoi}
          disasterType={disasterType}
          onDisasterTypeChange={setDisasterType}
          dates={dates}
          onDateChange={handleDateChange}
          onRun={handleRun}
          onLoadSources={handleLoadSources}
          onLoadBmkg={handleLoadBmkg}
          onLoadDem={handleLoadDem}
          runLoading={eventLoading}
          sourcesLoading={sourcesLoading}
          bmkgLoading={alertsLoading}
          demLoading={demLoading}
        />
      </div>

      <div className="col-lg-9">
        <div className="alert alert-info d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            <strong>Pemetaan bencana berbasis observasi citra.</strong>
            <div className="small">
              Modul ini memetakan area terindikasi terdampak dari data sebelum/sesudah kejadian, bukan
              prediksi risiko. Validasi lapangan dan laporan resmi tetap diperlukan.
            </div>
          </div>
        </div>

        <SourceStatusPanel loading={sourcesLoading} error={sourcesError} sources={sources} />
        <BmkgAlerts loading={alertsLoading} error={alertsError} alerts={alerts} />
        <DemSlopeControls loading={demLoading} error={demError} result={demResult} />

        <div className="mb-3">
          <EventSummary loading={eventLoading} error={eventError} result={eventResult} />
        </div>

        <MapView id="disasterMap" center={[-6.9667, 110.4167]} zoom={9}>
          <BasemapSwitcher />
          <AoiDrawingTools onChange={setAoi} />
          <DisasterEventMap
            aoi={aoi}
            sources={sources}
            demResult={demResult}
            eventResult={eventResult}
            fitSignal={fitSignal}
          />
        </MapView>
        <div className="mt-2">
          <MapLegend entries={legend} />
        </div>
      </div>
    </div>
  );
}
