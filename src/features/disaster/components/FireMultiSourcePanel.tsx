import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { ApiError } from "@/services/apiClient";
import { importFireObservations, loadFireMultiSource } from "../api";
import type { FireMultiSourceLayerState, FireMultiSourceResponse, FireSourceId } from "../types";
import { administrativePointCounts, visibleHotspots } from "../lib/fireLayers";

const SOURCES: { id: FireSourceId; label: string }[] = [
  { id: "firms_noaa20", label: "FIRMS VIIRS NOAA-20 · 375m" },
  { id: "firms_noaa21", label: "FIRMS VIIRS NOAA-21 · 375m" },
  { id: "firms_snpp", label: "FIRMS VIIRS S-NPP · 375m" },
  { id: "firms_modis", label: "FIRMS MODIS Terra/Aqua · 1km" },
  { id: "bmkg", label: "BMKG Geohotspot" },
  { id: "cdse", label: "CDSE Sentinel-2 · footprint scene" },
  { id: "mcd64a1", label: "NASA MCD64A1 · burned area 500m" },
  { id: "vnp64a1", label: "NASA VNP64A1 · burned area 500m" },
  { id: "inarisk", label: "BNPB InaRISK · indeks bahaya" },
];
const LABELS = Object.fromEntries(SOURCES.map((source) => [source.id, source.label]));
const STATUS_LABELS = {
  ok: "Tersedia",
  needs_key: "Perlu API key",
  no_data: "Belum ada data periode ini",
  unavailable: "Belum aktif",
  error: "Gagal dimuat",
};

interface Props {
  aoi: FeatureCollection | null;
  boundaries: FeatureCollection | null;
  region: string;
  startDate: string;
  endDate: string;
  onChange: (state: FireMultiSourceLayerState) => void;
}

export default function FireMultiSourcePanel({
  aoi,
  boundaries,
  region,
  startDate,
  endDate,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<FireSourceId[]>(() =>
    SOURCES.map((source) => source.id),
  );
  const [visible, setVisible] = useState<FireSourceId[]>(() =>
    SOURCES.filter((source) => source.id !== "cdse" && source.id !== "inarisk").map(
      (source) => source.id,
    ),
  );
  const [result, setResult] = useState<FireMultiSourceResponse | null>(null);
  const [showMerged, setShowMerged] = useState(true);
  const [imported, setImported] = useState<FeatureCollection | null>(null);
  const [showImport, setShowImport] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const layerState = useMemo(
    () => ({ result, visibleSources: visible, showMerged, imported, showImport }),
    [result, visible, showMerged, imported, showImport],
  );
  useEffect(() => {
    onChange(layerState);
  }, [layerState, onChange]);
  const pointCounts = useMemo(
    () => administrativePointCounts(boundaries, visibleHotspots(layerState)),
    [boundaries, layerState],
  );

  useEffect(() => {
    if (!result && !imported) {
      setDownloadUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            version: 1,
            context: { region, aoi, start_date: startDate, end_date: endDate, date_basis: "UTC" },
            result,
            imported,
          }),
        ],
        { type: "application/json" },
      ),
    );
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result, imported, region, aoi, startDate, endDate]);

  async function load() {
    if (!aoi) return;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await loadFireMultiSource({
        aoi: { geojson: aoi },
        start_date: startDate,
        end_date: endDate,
        sources: selected,
      });
      if (generation.current === current) setResult(response);
    } catch (reason) {
      if (generation.current === current)
        setError(
          reason instanceof ApiError ? reason.message : "Sumber karhutla belum dapat dimuat.",
        );
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Impor maksimal 2 MB.");
      return;
    }
    const current = generation.current;
    setImportBusy(true);
    setError("");
    try {
      const response = await importFireObservations(
        await file.text(),
        /\.(geojson|json)$/i.test(file.name) ? "geojson" : "csv",
      );
      if (generation.current === current) {
        setImported(response);
        setShowImport(true);
      }
    } catch (reason) {
      if (generation.current === current)
        setError(reason instanceof ApiError ? reason.message : "File tidak dapat diimpor.");
    } finally {
      if (generation.current === current) setImportBusy(false);
    }
  }

  return (
    <section
      className="disaster-kalimantan-controls fire-multi-source-panel"
      aria-label="Layer karhutla multi-sumber"
    >
      <div className="disaster-kalimantan-controls-title">
        <span>
          <i className="bi bi-stack" /> Karhutla multi-sumber
        </span>
        <small>{region}</small>
      </div>
      <p className="small text-muted mt-2 mb-2">
        Periode post: {startDate} sampai {endDate}. Maksimal 31 hari; pilih wilayah kecil untuk
        analisis detail.
      </p>
      <fieldset disabled={busy || importBusy} className="fire-source-picker">
        <legend className="small">Sumber yang akan dimuat</legend>
        {SOURCES.map((source) => (
          <label key={source.id}>
            <input
              type="checkbox"
              checked={selected.includes(source.id)}
              onChange={(event) =>
                setSelected((ids) =>
                  event.target.checked ? [...ids, source.id] : ids.filter((id) => id !== source.id),
                )
              }
            />
            {source.label}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className="btn btn-sm btn-primary mt-2"
        disabled={!aoi || busy || importBusy || selected.length === 0}
        onClick={() => void load()}
      >
        {busy ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" /> Memuat sumber…
          </>
        ) : (
          <>
            <i className="bi bi-cloud-download" /> Muat semua sumber terpilih
          </>
        )}
      </button>
      {error && (
        <div role="alert" className="alert alert-warning py-2 small mt-2 mb-0">
          {error}
        </div>
      )}
      {result && (
        <div aria-live="polite" className="mt-3">
          <div className="small mb-2">
            <strong>{result.raw_count.toLocaleString("id-ID")}</strong> observasi mentah ·{" "}
            <strong>{result.merged_count.toLocaleString("id-ID")}</strong> kelompok lintas sumber,
            bukan jumlah kejadian.
          </div>
          <label className="small d-flex gap-2 mb-2">
            <input
              type="checkbox"
              checked={showMerged}
              onChange={(event) => setShowMerged(event.target.checked)}
            />{" "}
            Gabungkan observasi lintas sumber dalam 500m/30menit
          </label>
          <div className="fire-source-status-list">
            {result.sources.map((source) => (
              <div key={source.id}>
                <label>
                  <input
                    type="checkbox"
                    disabled={source.status !== "ok"}
                    checked={source.status === "ok" && visible.includes(source.id)}
                    onChange={(event) =>
                      setVisible((ids) =>
                        event.target.checked
                          ? [...ids, source.id]
                          : ids.filter((id) => id !== source.id),
                      )
                    }
                  />
                  <strong>{LABELS[source.id]}</strong>
                </label>
                <small className={source.status === "ok" ? "text-success" : "text-warning"}>
                  {STATUS_LABELS[source.status]}
                  {source.features ? ` · ${source.features.length} fitur` : ""}
                  {source.area_ha != null
                    ? ` · ${source.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha`
                    : ""}
                  {source.truncated ? " · dibatasi, bukan total lengkap" : ""}
                </small>
                <small className="text-muted">{source.message}</small>
              </div>
            ))}
          </div>
          {pointCounts.length > 0 && (
            <details className="small mt-2">
              <summary>Observasi ditampilkan per wilayah ({pointCounts.length})</summary>
              <div className="fire-admin-counts">
                {pointCounts.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.count.toLocaleString("id-ID")}</strong>
                  </div>
                ))}
              </div>
            </details>
          )}
          <small className="text-muted d-block mt-2">
            {result.note} Diperbarui: {new Date(result.generated_at).toLocaleString("id-ID")}. Luas
            antarproduk tidak dijumlahkan.
          </small>
        </div>
      )}
      <details className="small mt-3">
        <summary>SIPONGI / impor CSV atau GeoJSON</summary>
        <p className="text-muted mt-2 mb-1">
          Unduh dari portal resmi atau unggah laporan lapangan. CSV harus memiliki
          longitude/latitude (bujur/lintang); CSV agregat tanpa koordinat tidak dibuat menjadi titik
          fiktif.
        </p>
        <a href="https://sipongi.menlhk.go.id/" target="_blank" rel="noreferrer">
          Buka SIPONGI
        </a>
        <label className="d-block mt-2">
          File observasi (maks. 2 MB)
          <input
            className="form-control form-control-sm mt-1"
            type="file"
            accept=".csv,.geojson,.json"
            disabled={importBusy || busy}
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {importBusy && <div role="status">Memeriksa file…</div>}
        {imported && (
          <label className="d-flex gap-2 mt-2">
            <input
              type="checkbox"
              checked={showImport}
              onChange={(event) => setShowImport(event.target.checked)}
            />{" "}
            Tampilkan impor ({imported.features.length} fitur; belum diverifikasi)
          </label>
        )}
        {imported && (
          <small className="text-muted d-block">
            Impor ditampilkan sesuai koordinat asli, tidak dipotong ke wilayah yang dipilih.
          </small>
        )}
      </details>
      {downloadUrl && (
        <a
          className="btn btn-sm btn-outline-success mt-2"
          href={downloadUrl}
          download="karhutla-multi-source.json"
        >
          <i className="bi bi-download" /> Unduh data + provenance
        </a>
      )}
      <div className="small text-muted mt-2">
        FIRMS memerlukan NASA_FIRMS_MAP_KEY di server.{" "}
        <a href="https://firms.modaps.eosdis.nasa.gov/api/area/" target="_blank" rel="noreferrer">
          Daftar key NASA
        </a>
        . SAM/dNBR tersedia pada kontrol analisis di atas. InaRISK adalah bahaya, bukan kejadian
        2026.
      </div>
    </section>
  );
}
