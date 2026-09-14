import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { RESULT_PANE } from "@/config/mapPanes";
import { ApiError } from "@/services/apiClient";
import { fetchCities, fetchProvinces } from "@/services/analysisService";
import type { RegionOption } from "@/types/api";
import {
  analyzeDisasterEvent,
  fetchFireBigBoundaries,
  fetchFireSamSegmentationJob,
  startFireSamSegmentation,
} from "../api";
import type {
  DisasterEventMapResponse,
  DisasterFireSamResult,
  FireMultiSourceLayerState,
} from "../types";
import FireMultiSourcePanel from "./FireMultiSourcePanel";
import { visibleHotspots } from "../lib/fireLayers";
import {
  KALIMANTAN_FIRE_2026,
  KALIMANTAN_FIRE_KNOWN_BURNED_AREA_HA,
  KALIMANTAN_FIRE_TOTAL_MEDIUM_CONFIDENCE,
  KALIMANTAN_FIRE_TOTAL_HIGH_CONFIDENCE,
} from "../data/kalimantan2026";

interface Props {
  onApplyFilter: () => void;
}

type BoundaryCollection = GeoJSON.FeatureCollection;
const EMPTY_FIRE_LAYERS: FireMultiSourceLayerState = {
  result: null,
  visibleSources: [],
  showMerged: true,
  imported: null,
  showImport: true,
};

function observationTooltip(feature: GeoJSON.Feature, layer: L.Layer) {
  const props = feature.properties ?? {};
  const text = document.createElement("span");
  text.textContent = [
    props.name ?? props.source ?? "Observasi",
    props.acquired_at,
    props.cloud_cover_pct != null ? `Awan ${props.cloud_cover_pct}%` : null,
    props.sensor,
    Array.isArray(props.source_ids) ? `Sumber: ${props.source_ids.join(", ")}` : props.source,
    feature.geometry?.type === "Point"
      ? `Lokasi: ${feature.geometry.coordinates.map((value) => value.toFixed(5)).join(", ")}`
      : null,
    props.confidence != null ? `confidence ${props.confidence}` : null,
    props.frp_mw != null ? `FRP ${props.frp_mw} MW` : null,
    props.observation_count ? `${props.observation_count} observasi` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  layer.bindTooltip(text, { sticky: true });
}

function FitBoundary({ data }: { data: BoundaryCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;
    const bounds = L.geoJSON(data as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [18, 18], maxZoom: 11 });
  }, [data, map]);

  return null;
}

function provinceName(feature?: GeoJSON.Feature): string {
  const value = feature?.properties?.PROVINSI ?? feature?.properties?.provinsi;
  return typeof value === "string" ? value : "Provinsi Kalimantan";
}

function provinceStyle(feature?: GeoJSON.Feature) {
  const name = provinceName(feature);
  const colors: Record<string, string> = {
    "KALIMANTAN BARAT": "#0f766e",
    "KALIMANTAN TENGAH": "#d97706",
    "KALIMANTAN SELATAN": "#dc2626",
    "KALIMANTAN TIMUR": "#2563eb",
    "KALIMANTAN UTARA": "#7c3aed",
  };
  return {
    color: colors[name] ?? "#334155",
    weight: 2,
    fillColor: colors[name] ?? "#64748b",
    fillOpacity: 0.17,
  };
}

function childBoundaryStyle() {
  return {
    color: "#475569",
    weight: 1,
    fillColor: "#94a3b8",
    fillOpacity: 0.04,
    dashArray: "4 3",
  };
}

function selectedBoundaryStyle() {
  return {
    color: "#0f766e",
    weight: 3,
    fillColor: "#14b8a6",
    fillOpacity: 0.12,
  };
}

export default function KalimantanFire2026Panel({ onApplyFilter }: Props) {
  const [fireLayers, setFireLayers] = useState<FireMultiSourceLayerState>(EMPTY_FIRE_LAYERS);
  const analysisRequestRef = useRef(0);
  const multiPoints = useMemo(() => visibleHotspots(fireLayers), [fireLayers]);
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [selectedBoundary, setSelectedBoundary] = useState<BoundaryCollection | null>(null);
  const [provinceBoundary, setProvinceBoundary] = useState<BoundaryCollection | null>(null);
  const [cityBoundaries, setCityBoundaries] = useState<BoundaryCollection | null>(null);
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [selectedRegionName, setSelectedRegionName] = useState("Seluruh Kalimantan");
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const regionRequestRef = useRef(0);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DisasterEventMapResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [samJobId, setSamJobId] = useState<string | null>(null);
  const [samResult, setSamResult] = useState<DisasterFireSamResult | null>(null);
  const [samLoading, setSamLoading] = useState(false);
  const [samError, setSamError] = useState<string | null>(null);
  const [beforeStart, setBeforeStart] = useState("2026-07-01");
  const [beforeEnd, setBeforeEnd] = useState("2026-07-31");
  const [afterStart, setAfterStart] = useState("2026-08-01");
  const [afterEnd, setAfterEnd] = useState("2026-08-31");
  const [showBefore, setShowBefore] = useState(false);
  const [showAfter, setShowAfter] = useState(true);
  const [showBurned, setShowBurned] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showSam, setShowSam] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setBoundaryError(null);

    fetchProvinces("Kalimantan")
      .then((options) => setProvinces(options))
      .catch(() => setRegionError("Daftar provinsi Kalimantan belum dapat dimuat."));

    fetch(KALIMANTAN_FIRE_2026.boundaryUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<BoundaryCollection>;
      })
      .then((data) => setBoundary(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBoundaryError("Batas BIG belum dapat dimuat. Sumber resmi tetap tersedia di bawah.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    analysisRequestRef.current += 1;
    setAnalysis(null);
    setAnalysisLoading(false);
    setAnalysisError(null);
    setFireLayers(EMPTY_FIRE_LAYERS);
    setSamJobId(null);
    setSamResult(null);
    setSamLoading(false);
    setSamError(null);
  }, [provinceCode, cityCode, beforeStart, beforeEnd, afterStart, afterEnd]);

  useEffect(() => {
    if (!samJobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    const poll = async () => {
      try {
        const job = await fetchFireSamSegmentationJob(samJobId);
        if (!active) return;
        failures = 0;
        if (job.status === "complete" && job.result) {
          setSamResult(job.result);
          setShowSam(true);
          setSamLoading(false);
          setSamJobId(null);
        } else if (job.status === "failed") {
          setSamError(job.message ?? "Segmentasi SAM gagal.");
          setSamLoading(false);
          setSamJobId(null);
        } else {
          timer = setTimeout(poll, 2500);
        }
      } catch (error) {
        if (!active) return;
        failures += 1;
        if (failures < 5) timer = setTimeout(poll, 3500);
        else {
          setSamError(
            error instanceof ApiError ? error.message : "Status segmentasi SAM tidak dapat dibaca.",
          );
          setSamLoading(false);
          setSamJobId(null);
        }
      }
    };

    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [samJobId]);

  async function handleProvinceChange(code: string) {
    const requestId = ++regionRequestRef.current;
    setProvinceCode(code);
    setCityCode("");
    setCities([]);
    setCityBoundaries(null);
    setSelectedBoundary(null);
    setProvinceBoundary(null);
    setRegionError(null);

    if (!code) {
      setSelectedBoundary(null);
      setProvinceBoundary(null);
      setSelectedRegionName("Seluruh Kalimantan");
      setRegionLoading(false);
      return;
    }

    setRegionLoading(true);
    try {
      const province = provinces.find((option) => option.code === code);
      const [geometry, cityOptions] = await Promise.all([
        fetchFireBigBoundaries(province?.name ?? code),
        fetchCities(code),
      ]);
      if (requestId !== regionRequestRef.current) return;
      setProvinceBoundary(geometry);
      setSelectedBoundary(geometry);
      setCities(cityOptions);
      setCityBoundaries(geometry);
      setSelectedRegionName(province?.name ?? code);
    } catch {
      if (requestId === regionRequestRef.current) {
        setRegionError("Batas provinsi atau kabupaten/kota belum dapat dimuat.");
      }
    } finally {
      if (requestId === regionRequestRef.current) setRegionLoading(false);
    }
  }

  async function handleCityChange(code: string) {
    const requestId = ++regionRequestRef.current;
    setCityCode(code);
    setRegionError(null);
    if (!code) {
      setSelectedBoundary(provinceBoundary);
      const province = provinces.find((option) => option.code === provinceCode);
      setSelectedRegionName(province?.name ?? "Seluruh Kalimantan");
      setRegionLoading(false);
      return;
    }

    setRegionLoading(true);
    try {
      const city = cities.find((option) => option.code === code);
      const province = provinces.find((option) => option.code === provinceCode);
      const geometry = await fetchFireBigBoundaries(province?.name ?? "", city?.name ?? code);
      if (requestId !== regionRequestRef.current) return;
      setSelectedBoundary(geometry);
      setSelectedRegionName(city?.name ?? code);
    } catch {
      if (requestId === regionRequestRef.current)
        setRegionError("Batas kabupaten/kota belum dapat dimuat.");
    } finally {
      if (requestId === regionRequestRef.current) setRegionLoading(false);
    }
  }

  const metricTotalLabel = useMemo(
    () => KALIMANTAN_FIRE_TOTAL_HIGH_CONFIDENCE.toLocaleString("id-ID"),
    [],
  );

  async function runFireAnalysis() {
    const requestId = analysisRequestRef.current;
    const analysisBoundary = selectedBoundary ?? boundary;
    if (!analysisBoundary) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await analyzeDisasterEvent({
        aoi: { geojson: analysisBoundary },
        event_type: "fire",
        before_start: beforeStart,
        before_end: beforeEnd,
        after_start: afterStart,
        after_end: afterEnd,
        dnbr_threshold: 0.27,
        scale: 20,
      });
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(result);
      setShowAfter(true);
      setShowBurned(true);
    } catch (error) {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysisError(
        error instanceof ApiError
          ? error.message
          : "Analisis citra belum berhasil dijalankan. Pastikan Earth Engine aktif.",
      );
    } finally {
      if (requestId === analysisRequestRef.current) setAnalysisLoading(false);
    }
  }

  async function runSamAnalysis() {
    const requestId = analysisRequestRef.current;
    const analysisBoundary = selectedBoundary ?? boundary;
    if (!analysisBoundary) return;
    setSamLoading(true);
    setSamError(null);
    setSamResult(null);
    try {
      const job = await startFireSamSegmentation({
        aoi: { geojson: analysisBoundary },
        start_date: afterStart,
        end_date: afterEnd,
        max_cloud_cover: 60,
        seed_radius_px: 12,
      });
      if (requestId !== analysisRequestRef.current) return;
      setSamJobId(job.job_id);
    } catch (error) {
      if (requestId !== analysisRequestRef.current) return;
      setSamError(
        error instanceof ApiError
          ? error.message
          : "Segmentasi alternatif SAM belum dapat dijalankan.",
      );
      setSamLoading(false);
    }
  }

  const hotspotFeatures = analysis?.hotspots?.features ?? [];
  const severity = analysis?.severity_area_ha;
  const mapBoundary = selectedBoundary ?? boundary;

  return (
    <section className="disaster-kalimantan-brief" aria-labelledby="kalimantanFireBriefTitle">
      <div className="disaster-kalimantan-brief-header">
        <div>
          <span className="disaster-eyebrow">Analisis cepat · 2026</span>
          <h2 id="kalimantanFireBriefTitle">Karhutla Kalimantan 2026</h2>
          <p>
            Ringkasan situasi berbasis rilis resmi dan batas administrasi BIG untuk membantu memilih
            event kebakaran hutan/lahan yang relevan.
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={onApplyFilter}>
          <i className="bi bi-funnel-fill" /> Tampilkan event 2026
        </button>
      </div>

      <div className="disaster-kalimantan-brief-grid">
        <div className="disaster-kalimantan-map-wrap">
          <MapView id="kalimantanFire2026Map" center={[-1.5, 114.5]} zoom={5} maxZoom={14}>
            <BasemapSwitcher />
            {fireLayers.result?.sources
              .filter(
                (source) => source.status === "ok" && fireLayers.visibleSources.includes(source.id),
              )
              .map((source) =>
                source.kind === "burned_area" && source.tile_url ? (
                  <TileLayer
                    key={source.tile_url}
                    url={source.tile_url}
                    opacity={0.65}
                    attribution={source.source}
                    pane={RESULT_PANE}
                  />
                ) : source.kind === "hazard" && source.wms_url ? (
                  <WMSTileLayer
                    key={source.id}
                    url={source.wms_url}
                    layers={source.wms_layers ?? "0"}
                    format="image/png"
                    transparent
                    opacity={0.25}
                    attribution="BNPB InaRISK · indeks bahaya (bukan kejadian)"
                    pane={RESULT_PANE}
                  />
                ) : source.kind === "footprints" && source.features ? (
                  <GeoJSON
                    key={`${source.id}-${fireLayers.result?.generated_at}`}
                    data={
                      {
                        type: "FeatureCollection",
                        features: source.features,
                      } as GeoJSON.FeatureCollection
                    }
                    style={{ color: "#0284c7", weight: 1, fillOpacity: 0.01, dashArray: "5 4" }}
                    onEachFeature={observationTooltip}
                  />
                ) : null,
              )}
            {multiPoints.features.length > 0 && (
              <GeoJSON
                key={`multi-${fireLayers.result?.generated_at}-${fireLayers.visibleSources.join(",")}-${fireLayers.showMerged}`}
                data={multiPoints}
                pointToLayer={(feature, latlng) =>
                  L.circleMarker(latlng, {
                    radius: 5,
                    color: "#7f1d1d",
                    weight: 1,
                    fillColor: feature.properties?.source_id === "bmkg" ? "#f59e0b" : "#ef4444",
                    fillOpacity: 0.85,
                  })
                }
                onEachFeature={observationTooltip}
              />
            )}
            {fireLayers.showImport && fireLayers.imported && (
              <GeoJSON
                key={`import-${fireLayers.imported.features[0]?.properties?.import_batch_id}`}
                data={fireLayers.imported}
                style={{ color: "#be185d", weight: 2, fillOpacity: 0.15 }}
                pointToLayer={(_feature, latlng) =>
                  L.circleMarker(latlng, { radius: 5, color: "#be185d" })
                }
                onEachFeature={observationTooltip}
              />
            )}
            {showBefore && analysis?.before_tile_url && (
              <TileLayer
                key={`fire-before-${analysis.before_tile_url}`}
                url={analysis.before_tile_url}
                opacity={0.58}
                attribution="Sentinel-2 SR Harmonized · sebelum"
                pane={RESULT_PANE}
              />
            )}
            {showAfter && analysis?.after_tile_url && (
              <TileLayer
                key={`fire-after-${analysis.after_tile_url}`}
                url={analysis.after_tile_url}
                opacity={0.58}
                attribution="Sentinel-2 SR Harmonized · sesudah"
                pane={RESULT_PANE}
              />
            )}
            {showBurned && analysis?.tile_url && (
              <TileLayer
                key={`fire-result-${analysis.tile_url}`}
                url={analysis.tile_url}
                opacity={0.82}
                attribution="SAVEGEO · dNBR Sentinel-2"
                pane={RESULT_PANE}
              />
            )}
            {showHotspots && !fireLayers.result && hotspotFeatures.length > 0 && (
              <GeoJSON
                key={`fire-hotspots-${hotspotFeatures.length}`}
                data={
                  {
                    type: "FeatureCollection",
                    features: hotspotFeatures,
                  } as GeoJSON.FeatureCollection
                }
                pointToLayer={(_feature, latlng) =>
                  L.circleMarker(latlng, {
                    radius: 5,
                    color: "#991b1b",
                    weight: 1,
                    fillColor: "#ef4444",
                    fillOpacity: 0.85,
                  })
                }
                onEachFeature={(feature, layer) => {
                  const confidence = feature.properties?.fire_confidence;
                  layer.bindTooltip(
                    `${feature.properties?.name ?? "Hotspot MODIS"}${confidence ? ` · confidence ${confidence}` : ""}`,
                  );
                }}
              />
            )}
            {showSam && samResult && (
              <GeoJSON
                key={`fire-sam-${samResult.features.length}`}
                data={samResult}
                style={{ color: "#7c3aed", weight: 2, fillColor: "#a855f7", fillOpacity: 0.2 }}
                onEachFeature={(_feature, layer) =>
                  layer.bindTooltip("Kandidat area terbakar · MODIS-seeded SAM")
                }
              />
            )}
            {!selectedBoundary && boundary && (
              <GeoJSON
                key="kalimantan-admin-boundary-2026"
                data={boundary}
                style={provinceStyle}
                onEachFeature={(feature, layer) => {
                  layer.bindTooltip(provinceName(feature), { sticky: true });
                }}
              />
            )}
            {selectedBoundary && (
              <GeoJSON
                key={`selected-fire-boundary-${provinceCode}-${cityCode}`}
                data={selectedBoundary}
                style={selectedBoundaryStyle}
                onEachFeature={observationTooltip}
              />
            )}
            {cityBoundaries && (
              <GeoJSON
                key={`fire-city-boundaries-${provinceCode}`}
                data={cityBoundaries}
                style={childBoundaryStyle}
                onEachFeature={observationTooltip}
              />
            )}
            <FitBoundary data={mapBoundary} />
          </MapView>
          {boundaryError && <div className="small text-warning mt-2">{boundaryError}</div>}
          {!boundary && !boundaryError && (
            <div className="small text-muted mt-2">
              <span className="spinner-border spinner-border-sm me-1" /> Memuat batas provinsi dari
              BIG…
            </div>
          )}
          <div className="small text-muted mt-2">
            Layer:{" "}
            <a href={KALIMANTAN_FIRE_2026.boundarySource} target="_blank" rel="noreferrer">
              BIG · 34 Provinsi
            </a>
          </div>
          <div className="disaster-kalimantan-region-controls">
            <div className="disaster-kalimantan-controls-title">
              <span>
                <i className="bi bi-diagram-3" /> Muat layer wilayah
              </span>
              <small>{regionLoading ? "Memuat geometri…" : `AOI: ${selectedRegionName}`}</small>
            </div>
            <div className="disaster-kalimantan-region-grid">
              <label>
                Provinsi
                <select
                  value={provinceCode}
                  onChange={(event) => void handleProvinceChange(event.target.value)}
                  disabled={regionLoading}
                >
                  <option value="">Seluruh Kalimantan</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kabupaten/kota
                <select
                  value={cityCode}
                  onChange={(event) => void handleCityChange(event.target.value)}
                  disabled={!provinceCode || regionLoading}
                >
                  <option value="">Semua kabupaten/kota di provinsi</option>
                  {cities.map((city) => (
                    <option key={city.code} value={city.code}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {regionError && <div className="small text-warning mt-2">{regionError}</div>}
            <div className="small text-muted mt-2">
              Pilih provinsi untuk memuat batas kabupaten/kota. Analisis citra memakai wilayah yang
              dipilih.
            </div>
          </div>
          <div className="disaster-kalimantan-controls">
            <div className="disaster-kalimantan-controls-title">
              <span>
                <i className="bi bi-camera-reels" /> Jalankan analisis citra
              </span>
              {analysis && <small>{analysis.source}</small>}
            </div>
            <div className="disaster-kalimantan-date-grid">
              <label>
                Pre mulai
                <input
                  type="date"
                  value={beforeStart}
                  onChange={(event) => setBeforeStart(event.target.value)}
                />
              </label>
              <label>
                Pre akhir
                <input
                  type="date"
                  value={beforeEnd}
                  onChange={(event) => setBeforeEnd(event.target.value)}
                />
              </label>
              <label>
                Post mulai
                <input
                  type="date"
                  value={afterStart}
                  onChange={(event) => setAfterStart(event.target.value)}
                />
              </label>
              <label>
                Post akhir
                <input
                  type="date"
                  value={afterEnd}
                  onChange={(event) => setAfterEnd(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={runFireAnalysis}
              disabled={!mapBoundary || regionLoading || !!regionError || analysisLoading}
            >
              {analysisLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> Memproses
                  Sentinel-2/MODIS…
                </>
              ) : (
                <>
                  <i className="bi bi-play-fill" /> Hitung area terdampak
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary ms-2"
              onClick={runSamAnalysis}
              disabled={!mapBoundary || regionLoading || !!regionError || samLoading}
            >
              {samLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> Segmentasi SAM…
                </>
              ) : (
                <>
                  <i className="bi bi-bounding-box" /> Alternatif SAM
                </>
              )}
            </button>
            {analysisError && (
              <div className="alert alert-warning py-2 mt-2 mb-0">{analysisError}</div>
            )}
            {samError && <div className="alert alert-warning py-2 mt-2 mb-0">{samError}</div>}
            {samResult && (
              <div className="small text-muted mt-2">
                SAM mempertahankan {samResult.features.length.toLocaleString("id-ID")} poligon yang
                berdekatan dengan seed hotspot MODIS.
              </div>
            )}
            {(analysis || samResult) && (
              <div className="disaster-kalimantan-layer-switches">
                {analysis && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showBefore}
                      onChange={(event) => setShowBefore(event.target.checked)}
                    />{" "}
                    Citra pre
                  </label>
                )}
                {analysis && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showAfter}
                      onChange={(event) => setShowAfter(event.target.checked)}
                    />{" "}
                    Citra post
                  </label>
                )}
                {analysis && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showBurned}
                      onChange={(event) => setShowBurned(event.target.checked)}
                    />{" "}
                    Area terbakar
                  </label>
                )}
                {analysis && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showHotspots}
                      onChange={(event) => setShowHotspots(event.target.checked)}
                    />{" "}
                    Titik hotspot
                  </label>
                )}
                {samResult && (
                  <label>
                    <input
                      type="checkbox"
                      checked={showSam}
                      onChange={(event) => setShowSam(event.target.checked)}
                    />{" "}
                    Poligon SAM
                  </label>
                )}
              </div>
            )}
          </div>
          <FireMultiSourcePanel
            key={`${provinceCode}-${cityCode}-${beforeStart}-${beforeEnd}-${afterStart}-${afterEnd}`}
            aoi={regionLoading || regionError ? null : mapBoundary}
            boundaries={cityBoundaries ?? boundary}
            region={selectedRegionName}
            startDate={afterStart}
            endDate={afterEnd}
            onChange={setFireLayers}
          />
        </div>

        <div className="disaster-kalimantan-facts">
          <div className="disaster-kalimantan-stat-grid">
            <div>
              <span>Hotspot high confidence</span>
              <strong>{metricTotalLabel}</strong>
              <small>
                high confidence · {KALIMANTAN_FIRE_TOTAL_MEDIUM_CONFIDENCE.toLocaleString("id-ID")}{" "}
                medium confidence
              </small>
            </div>
            <div>
              <span>Luas terbakar tercatat</span>
              <strong>
                {KALIMANTAN_FIRE_KNOWN_BURNED_AREA_HA.toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}{" "}
                ha
              </strong>
              <small>angka provinsi Jan–Jun yang tersedia pada rilis</small>
            </div>
          </div>

          <div className="disaster-kalimantan-province-list">
            {KALIMANTAN_FIRE_2026.metrics.map((metric) => (
              <div key={metric.province}>
                <div>
                  <strong>{metric.province}</strong>
                  <span>
                    {metric.highConfidence == null
                      ? "Data hotspot tidak dirinci"
                      : `${metric.highConfidence.toLocaleString("id-ID")} hotspot`}
                  </span>
                </div>
                <small>{metric.note}</small>
              </div>
            ))}
          </div>

          {analysis && (
            <div className="disaster-kalimantan-live-result">
              <div className="disaster-kalimantan-live-result-heading">
                <strong>Hasil analisis spasial</strong>
                <span>
                  {analysis.before_period.start} → {analysis.after_period.end}
                </span>
              </div>
              <div className="disaster-kalimantan-live-kpis">
                <div>
                  <span>Area terdampak</span>
                  <strong>
                    {analysis.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha
                  </strong>
                </div>
                <div>
                  <span>Titik MODIS</span>
                  <strong>{analysis.hotspots?.count.toLocaleString("id-ID") ?? "0"}</strong>
                </div>
                <div>
                  <span>Scene pre/post</span>
                  <strong>
                    {analysis.before_scene_count ?? 0}/{analysis.after_scene_count ?? 0}
                  </strong>
                </div>
              </div>
              {severity && (
                <div className="disaster-kalimantan-severity-list">
                  <span>Rincian kelas dNBR</span>
                  <div>
                    <em className="severity-low" /> Rendah{" "}
                    <strong>
                      {severity.low_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha
                    </strong>
                  </div>
                  <div>
                    <em className="severity-moderate" /> Sedang{" "}
                    <strong>
                      {severity.moderate_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{" "}
                      ha
                    </strong>
                  </div>
                  <div>
                    <em className="severity-high" /> Tinggi{" "}
                    <strong>
                      {severity.high_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha
                    </strong>
                  </div>
                  <div>
                    <em className="severity-very-high" /> Sangat tinggi{" "}
                    <strong>
                      {severity.very_high_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{" "}
                      ha
                    </strong>
                  </div>
                </div>
              )}
              <small className="text-muted d-block mt-2">
                {analysis.method_note} {analysis.hotspots?.note}
              </small>
            </div>
          )}
        </div>
      </div>

      <div className="disaster-kalimantan-brief-footer">
        <div>
          <i className="bi bi-info-circle" /> Hotspot adalah indikasi anomali suhu permukaan, bukan
          otomatis satu kejadian kebakaran. Verifikasi lapangan tetap diperlukan.
        </div>
        <div className="disaster-kalimantan-sources">
          {KALIMANTAN_FIRE_2026.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.summary}
            >
              {source.publisher} · {source.date}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
