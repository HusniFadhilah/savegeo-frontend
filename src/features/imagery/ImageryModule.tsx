import { useCallback, useEffect, useMemo, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AoiPickerModal from "@/components/map/AoiPickerModal";
import { RESULT_PANE } from "@/config/mapPanes";
import { useAoiStore } from "@/hooks/useAoiStore";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import { getVegetationSatellites } from "@/features/vegetation/api";
import type { SatelliteProvider } from "@/features/vegetation/types";
import type { AoiFeature } from "@/types/map";
import { getImagerySceneTile, listImageryScenes } from "./api";
import type { ImageryScene } from "./types";

const AOI_STYLE = { color: "#0d6efd", weight: 2, fillOpacity: 0.05 };
type ViewMode = "single" | "compare";

function FitToAoi({ aoi }: { aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [aoi, map]);
  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatAcquired(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function cloudBadgeClass(pct: number | null): string {
  if (pct == null) return "bg-secondary";
  if (pct <= 20) return "bg-success";
  if (pct <= 60) return "bg-warning text-dark";
  return "bg-danger";
}

/**
 * Raw satellite imagery browser - pick an exact scene by its real acquisition
 * date+time (not a composite over a range) and view it as true-color RGB.
 * Answers the user's direct request: "bagaimana bisa melihat citra satelit
 * utk tanggal beserta jam tertentu, tanpa harus land cover?" - every other
 * module (Vegetation/Carbon/LC-Change) always composites over a date range
 * and only ever exposes month- or (Dynamic World only) day-level granularity;
 * none of them expose a single scene's real overpass time or show it
 * unmodified (no cloud masking - the point here is to look at the scene
 * as-is, clouds included, and judge it yourself).
 */
export default function ImageryModule() {
  const aoiState = useAoiStore((s) => s.aoi);
  const setAoiState = useAoiStore((s) => s.setAoi);
  const aoi: AoiFeature | null = aoiState?.feature ?? null;
  const [aoiModalOpen, setAoiModalOpen] = useState(false);

  const handleAoiChange = useCallback(
    (feature: AoiFeature | null) => {
      if (!feature) {
        setAoiState(null);
        return;
      }
      const bounds = boundsFromGeoJSON(feature);
      setAoiState({ source: "drawn", name: "Poligon Kustom", areaKm2: areaKm2(feature, bounds), feature, bounds });
    },
    [setAoiState],
  );

  const [satellites, setSatellites] = useState<Record<string, SatelliteProvider>>({});
  const [satellite, setSatellite] = useState("sentinel2");
  useEffect(() => {
    let cancelled = false;
    getVegetationSatellites()
      .then((res) => {
        if (cancelled) return;
        setSatellites(res.satellites);
        setSatellite(res.default);
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [startDate, setStartDate] = useState(daysAgoIso(30));
  const [endDate, setEndDate] = useState(todayIso());
  const [cloudFilterEnabled, setCloudFilterEnabled] = useState(false);
  const [maxCloudCover, setMaxCloudCover] = useState(60);

  const [scenes, setScenes] = useState<ImageryScene[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  // "Bandingkan 2 Waktu" (user request) - swipe/compare slider between two
  // individual scenes (not composites), reusing the same SwipeCompareMap
  // already shared by Carbon/LC-Change - vertical/horizontal + pan-lock come
  // for free from that component.
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [compareSceneAId, setCompareSceneAId] = useState<string | null>(null);
  const [compareSceneBId, setCompareSceneBId] = useState<string | null>(null);
  const [compareOrientation, setCompareOrientation] = useState<SwipeOrientation>("vertical");
  const [compareTileA, setCompareTileA] = useState<string | null>(null);
  const [compareTileB, setCompareTileB] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const satelliteMeta = satellites[satellite];

  const searchScenes = async () => {
    if (!aoi) {
      setSearchError("Gambar AOI terlebih dahulu di peta.");
      return;
    }
    if (!startDate || !endDate || startDate >= endDate) {
      setSearchError("Rentang tanggal tidak valid (tanggal awal harus sebelum tanggal akhir).");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelectedSceneId(null);
    setTileUrl(null);
    setTileError(null);
    setCompareSceneAId(null);
    setCompareSceneBId(null);
    setCompareTileA(null);
    setCompareTileB(null);
    setCompareError(null);
    try {
      // GEE's filterDate end bound is exclusive - bump by 1 day so the
      // end-date the user picked is actually included, matching how every
      // other date-range control in this app (build_date_range) behaves.
      const inclusiveEnd = new Date(endDate);
      inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
      const res = await listImageryScenes({
        aoi: { geojson: aoi },
        satellite,
        startDate,
        endDate: inclusiveEnd.toISOString().slice(0, 10),
        maxCloudCover: cloudFilterEnabled ? maxCloudCover : undefined,
      });
      setScenes(res.scenes);
      setTruncated(res.truncated);
      setSearched(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Gagal memuat daftar scene.");
      setScenes([]);
    } finally {
      setSearching(false);
    }
  };

  const selectScene = async (scene: ImageryScene) => {
    setSelectedSceneId(scene.id);
    setTileLoading(true);
    setTileError(null);
    setTileUrl(null);
    try {
      const res = await getImagerySceneTile({
        satellite,
        sceneId: scene.id,
        aoi: aoi ? { geojson: aoi } : undefined,
      });
      setTileUrl(res.tile_url);
    } catch (err) {
      setTileError(err instanceof Error ? err.message : "Gagal memuat citra scene ini.");
    } finally {
      setTileLoading(false);
    }
  };

  const loadCompare = async () => {
    if (!compareSceneAId || !compareSceneBId) {
      setCompareError("Pilih Scene A dan Scene B terlebih dahulu.");
      return;
    }
    if (compareSceneAId === compareSceneBId) {
      setCompareError("Scene A dan Scene B harus berbeda.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    setCompareTileA(null);
    setCompareTileB(null);
    try {
      const [resA, resB] = await Promise.all([
        getImagerySceneTile({ satellite, sceneId: compareSceneAId, aoi: aoi ? { geojson: aoi } : undefined }),
        getImagerySceneTile({ satellite, sceneId: compareSceneBId, aoi: aoi ? { geojson: aoi } : undefined }),
      ]);
      setCompareTileA(resA.tile_url);
      setCompareTileB(resB.tile_url);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Gagal memuat salah satu citra scene.");
    } finally {
      setCompareLoading(false);
    }
  };

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1)),
    [scenes],
  );

  return (
    <div className="analysis-page analysis-page-imagery">
      <section className="analysis-hero analysis-hero-imagery" aria-labelledby="imageryHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">Citra Satelit</span>
          <h1 id="imageryHeroTitle">Eksplorasi Scene Satelit</h1>
          <p>
            Cari scene berdasarkan tanggal akuisisi, cek awan, lalu tampilkan citra true-color asli atau bandingkan dua
            scene secara berdampingan.
          </p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-bounding-box-circles" />
            <div>
              <span>AOI</span>
              <strong>{aoi ? aoi.geometry.type : "Belum digambar"}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-satellite" />
            <div>
              <span>Satelit</span>
              <strong>{satelliteMeta?.name ?? satellite}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-images" />
            <div>
              <span>Scene</span>
              <strong>{searched ? `${sortedScenes.length} ditemukan` : "Belum dicari"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-lg-3">
        <div className="sidebar">
          <h5 className="mb-3">
            <i className="fas fa-camera" /> Citra Satelit
          </h5>
          <p className="text-muted small">
            Lihat citra mentah satu scene asli (bukan komposit) beserta tanggal dan jam akuisisi persisnya - tanpa
            analisis tutupan lahan/vegetasi/karbon.
          </p>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-map-marker-alt" /> Area of Interest
            </label>
            {aoi ? (
              <div className="alert alert-success py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-check-circle" /> AOI tergambar ({aoi.geometry.type})
              </div>
            ) : (
              <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-exclamation-triangle" /> Pilih AOI lewat modal peta.
              </div>
            )}
            <button type="button" className="btn btn-sm btn-outline-success w-100 mt-2" onClick={() => setAoiModalOpen(true)}>
              <i className="bi bi-bounding-box-circles" /> Pilih/Gambar AOI
            </button>
            {aoi && (
              <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => setAoiState(null)}>
                <i className="fas fa-eraser" /> Hapus AOI
              </button>
            )}
          </div>

          <hr />

          <div className="mb-3">
            <label className="form-label fw-bold" htmlFor="imagerySatellite">
              <i className="fas fa-satellite" /> Satelit
            </label>
            <SearchableSelect
              id="imagerySatellite"
              value={satellite}
              onChange={setSatellite}
              options={Object.values(satellites).map((s) => ({ value: s.key, label: s.name }))}
            />
            {satelliteMeta && (
              <small className="text-muted d-block mt-1">
                {satelliteMeta.resolution_label} · revisit ~{satelliteMeta.revisit_days} hari · sejak {satelliteMeta.start_year}
              </small>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-calendar" /> Rentang Tanggal
            </label>
            <div className="d-flex align-items-center gap-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
              <span className="text-muted">–</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={todayIso()}
              />
            </div>
            <small className="text-muted">Semua scene asli di rentang ini akan dicari (maks. 200 hasil).</small>
          </div>

          <div className="mb-3">
            <div className="form-check form-switch mb-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="imageryCloudFilterSwitch"
                checked={cloudFilterEnabled}
                onChange={(e) => setCloudFilterEnabled(e.target.checked)}
              />
              <label className="form-check-label fw-bold" htmlFor="imageryCloudFilterSwitch">
                <i className="fas fa-cloud" /> Filter Tutupan Awan
              </label>
            </div>
            {cloudFilterEnabled && (
              <div className="d-flex align-items-center gap-2">
                <input
                  type="range"
                  className="form-range"
                  min={0}
                  max={100}
                  step={5}
                  value={maxCloudCover}
                  onChange={(e) => setMaxCloudCover(Number(e.target.value))}
                />
                <span className="badge bg-secondary" style={{ minWidth: 48 }}>
                  ≤{maxCloudCover}%
                </span>
              </div>
            )}
            {!cloudFilterEnabled && (
              <small className="text-muted d-block">
                Nonaktif: semua scene ditampilkan apa adanya (termasuk yang sangat berawan) supaya bisa dinilai sendiri.
              </small>
            )}
          </div>

          <hr />

          {searchError && (
            <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".8rem" }}>
              {searchError}
            </div>
          )}

          <button className="btn btn-warning w-100 fw-bold" disabled={searching} onClick={searchScenes}>
            {searching ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Mencari...
              </>
            ) : (
              <>
                <i className="fas fa-search" /> Cari Scene
              </>
            )}
          </button>
        </div>
      </div>

      <div className="col-lg-9">
        {!searched && (
          <div className="card text-center py-5 border-dashed mb-3">
            <div className="card-body">
              <i className="bi bi-camera text-muted" style={{ fontSize: "3.5rem" }} />
              <h5 className="mt-3 text-muted">Belum Ada Pencarian</h5>
              <p className="text-muted mb-0">
                Gambar AOI, pilih satelit dan rentang tanggal, lalu klik <strong>Cari Scene</strong>
              </p>
            </div>
          </div>
        )}

        {searched && (
          <div className="card mb-3">
            <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold">
                <i className="bi bi-list-ul" /> Scene Ditemukan
              </span>
              <span className="badge bg-secondary">{scenes.length}</span>
              {truncated && (
                <span className="badge bg-warning text-dark" title="Hasil dibatasi 200 scene - persempit rentang tanggal untuk melihat semuanya">
                  dibatasi 200
                </span>
              )}
              <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Mode tampilan">
                <button
                  type="button"
                  className={`btn ${viewMode === "single" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("single")}
                >
                  Satu Scene
                </button>
                <button
                  type="button"
                  className={`btn ${viewMode === "compare" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("compare")}
                >
                  <i className="fas fa-arrows-alt-h" /> Bandingkan 2 Waktu
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {scenes.length === 0 ? (
                <div className="p-3 text-center text-muted small">
                  Tidak ada scene ditemukan untuk AOI/rentang/filter ini. Coba perlebar rentang tanggal atau nonaktifkan
                  filter awan.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-primary sticky-top">
                      <tr>
                        <th>Tanggal &amp; Jam Akuisisi (UTC)</th>
                        <th>Tutupan Awan</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedScenes.map((scene) => (
                        <tr
                          key={scene.id}
                          className={selectedSceneId === scene.id ? "table-warning" : ""}
                          style={{ cursor: "pointer" }}
                          onClick={() => selectScene(scene)}
                        >
                          <td>{formatAcquired(scene.acquired_at)}</td>
                          <td>
                            <span className={`badge ${cloudBadgeClass(scene.cloud_cover_pct)}`}>
                              {scene.cloud_cover_pct != null ? `${scene.cloud_cover_pct}%` : "-"}
                            </span>
                          </td>
                          <td className="text-end">
                            {selectedSceneId === scene.id ? (
                              <i className="bi bi-eye-fill text-warning" />
                            ) : (
                              <i className="bi bi-eye text-muted" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === "single" && (
          <>
            {tileError && <div className="alert alert-danger py-2 mb-3">{tileError}</div>}
            {tileLoading && (
              <div className="alert alert-info py-2 mb-3">
                <i className="fas fa-spinner fa-spin" /> Memuat citra scene...
              </div>
            )}

            <div className="card">
              <div className="card-header py-2">
                <i className="bi bi-map" /> Peta
                {selectedSceneId && (
                  <span className="text-muted small ms-2">
                    - menampilkan scene {formatAcquired(scenes.find((s) => s.id === selectedSceneId)?.acquired_at ?? "")}
                  </span>
                )}
              </div>
              <div className="card-body p-2">
                <MapView id="imagerySceneMap">
                  <BasemapSwitcher />
                  {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
                  {tileUrl && <TileLayer url={tileUrl} opacity={1} attribution="Google Earth Engine" pane={RESULT_PANE} />}
                  <FitToAoi aoi={aoi} />
                </MapView>
              </div>
            </div>
          </>
        )}

        {viewMode === "compare" && searched && (
          <>
            <div className="card mb-3">
              <div className="card-header py-2">
                <i className="bi bi-arrows-alt-h" /> Pilih 2 Waktu untuk Dibandingkan
              </div>
              <div className="card-body">
                <div className="row g-2 mb-2">
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene A (Sebelum)</label>
                    <SearchableSelect
                      value={compareSceneAId ?? ""}
                      onChange={(v) => setCompareSceneAId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatAcquired(s.acquired_at)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
                      }))}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene B (Sesudah)</label>
                    <SearchableSelect
                      value={compareSceneBId ?? ""}
                      onChange={(v) => setCompareSceneBId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatAcquired(s.acquired_at)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
                      }))}
                    />
                  </div>
                </div>
                {compareError && <div className="alert alert-danger py-2 mb-2">{compareError}</div>}
                <button className="btn btn-warning fw-bold" disabled={compareLoading} onClick={loadCompare}>
                  {compareLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Memuat...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-arrows-alt-h" /> Muat Perbandingan
                    </>
                  )}
                </button>
              </div>
            </div>

            {compareTileA && compareTileB ? (
              <div className="card">
                <div className="card-body p-0">
                  <SwipeCompareMap
                    id="imageryCompareMap"
                    beforeUrl={compareTileA}
                    afterUrl={compareTileB}
                    beforeLabel={formatAcquired(scenes.find((s) => s.id === compareSceneAId)?.acquired_at ?? "")}
                    afterLabel={formatAcquired(scenes.find((s) => s.id === compareSceneBId)?.acquired_at ?? "")}
                    orientation={compareOrientation}
                    onOrientationChange={setCompareOrientation}
                  >
                    {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} pane={RESULT_PANE} />}
                    <FitToAoi aoi={aoi} />
                  </SwipeCompareMap>
                </div>
              </div>
            ) : (
              <div className="card text-center py-5 border-dashed">
                <div className="card-body">
                  <i className="bi bi-arrows-angle-expand text-muted" style={{ fontSize: "2.5rem" }} />
                  <p className="text-muted mb-0 mt-2">Pilih Scene A dan Scene B, lalu klik Muat Perbandingan.</p>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
      <AoiPickerModal
        open={aoiModalOpen}
        id="imageryAoiModalMap"
        title="Pilih AOI Scene Satelit"
        description="Pilih wilayah administrasi, koordinat, gambar polygon/rectangle, unggah file, atau pilih batas perusahaan."
        aoi={aoiState}
        onAoiChange={setAoiState}
        onClose={() => setAoiModalOpen(false)}
      />
    </div>
  );
}
