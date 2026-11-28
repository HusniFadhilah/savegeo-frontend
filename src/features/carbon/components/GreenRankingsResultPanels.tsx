import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import CropPanelAccordion from "@/features/crop-monitoring/components/CropPanelAccordion";
import { apiClient } from "@/services/apiClient";
import { fetchProvinceGeometries } from "@/services/analysisService";
import type { GreenRankingResult, GreenRankingRow } from "../extendedTypes";
import "./green-rankings-result-panels.css";

type Indicator = {
  key: string;
  label: string;
  unit: "%" | "ha" | "Mg C/ha";
  value: (row: GreenRankingRow) => number | null | undefined;
  total?: (row: GreenRankingRow) => number | null | undefined;
  pool?: string;
  kind: "percent" | "area" | "density";
};

type RankingFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type RankingCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

const indicators: Indicator[] = [
  { key: "green_percent", label: "Tutupan hijau", unit: "%", value: (row) => row.green_percent, kind: "percent" },
  { key: "coverage_percent", label: "Cakupan data", unit: "%", value: (row) => row.coverage_percent, kind: "percent" },
  { key: "area_ha", label: "Luas wilayah", unit: "ha", value: (row) => row.area_ha, kind: "area" },
  { key: "valid_area_ha", label: "Luas berpiksel valid", unit: "ha", value: (row) => row.valid_area_ha, kind: "area" },
  { key: "green_area_ha", label: "Luas tutupan hijau", unit: "ha", value: (row) => row.green_area_ha, kind: "area" },
  { key: "trees_ha", label: "Pohon", unit: "ha", value: (row) => row.classes_ha?.trees, kind: "area" },
  { key: "grass_ha", label: "Rumput", unit: "ha", value: (row) => row.classes_ha?.grass, kind: "area" },
  { key: "crops_ha", label: "Tanaman", unit: "ha", value: (row) => row.classes_ha?.crops, kind: "area" },
  { key: "shrubs_ha", label: "Semak", unit: "ha", value: (row) => row.classes_ha?.shrubs, kind: "area" },
  { key: "flooded_ha", label: "Vegetasi tergenang", unit: "ha", value: (row) => row.classes_ha?.flooded, kind: "area" },
  { key: "agb", label: "AGB · biomassa atas", unit: "Mg C/ha", value: (row) => row.agb_mg_c_ha, total: (row) => row.agb_total_mg_c, pool: "agb", kind: "density" },
  { key: "bgb", label: "BGB · biomassa bawah", unit: "Mg C/ha", value: (row) => row.bgb_mg_c_ha, total: (row) => row.bgb_total_mg_c, pool: "bgb", kind: "density" },
  { key: "soc", label: "SOC · karbon tanah", unit: "Mg C/ha", value: (row) => row.soc_mg_c_ha, total: (row) => row.soc_total_mg_c, pool: "soc", kind: "density" },
  { key: "litter", label: "Serasah", unit: "Mg C/ha", value: (row) => row.litter_mg_c_ha, total: (row) => row.litter_total_mg_c, pool: "litter", kind: "density" },
  { key: "deadwood", label: "Kayu mati", unit: "Mg C/ha", value: (row) => row.deadwood_mg_c_ha, total: (row) => row.deadwood_total_mg_c, pool: "deadwood", kind: "density" },
];

const colorRamp = ["#00204c", "#414d6b", "#777b78", "#b5a965", "#ffe945"];
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const format = (value: number | null, unit: Indicator["unit"]) =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value)}${unit === "%" ? "%" : ` ${unit}`}`;

async function loadAllRows(
  runId: string,
  filters: { year: number; startMonth: number; endMonth: number; level: string; province: string; city: string; district: string },
  signal: AbortSignal,
): Promise<GreenRankingRow[]> {
  const pageSize = 100;
  const getPage = (page: number) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort_by: "rank", sort_dir: "asc" });
    if (runId.startsWith("snapshot:")) {
      params.set("year", String(filters.year));
      params.set("start_month", String(filters.startMonth));
      params.set("end_month", String(filters.endMonth));
      params.set("level", filters.level);
      if (filters.province) params.set("province", filters.province);
      if (filters.city) params.set("city", filters.city);
      if (filters.district) params.set("district", filters.district);
    }
    return apiClient.get<GreenRankingResult>(
      `/carbon/green-rankings/${encodeURIComponent(runId)}?${params.toString()}`,
      { auth: "app", signal },
    );
  };
  const first = await getPage(1);
  const total = first.records_total ?? first.records_filtered ?? first.rows.length;
  if (total > 2000) throw new Error("Peta dibatasi untuk hasil sampai 2.000 wilayah. Persempit wilayah induk terlebih dahulu.");
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return first.rows;
  const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => getPage(index + 2)));
  return [...first.rows, ...remaining.flatMap((page) => page.rows)];
}

function metricPoolArea(row: GreenRankingRow, pool?: string) {
  return pool ? row.carbon_pool_sources?.[pool]?.valid_area_ha ?? row.valid_area_ha ?? row.area_ha ?? 0 : row.valid_area_ha ?? row.area_ha ?? 0;
}

function metricSummary(rows: GreenRankingRow[], indicator: Indicator) {
  const validRows = rows.filter((row) => finite(indicator.value(row)));
  if (indicator.kind === "density") {
    const validArea = validRows.reduce((sum, row) => sum + metricPoolArea(row, indicator.pool), 0);
    const total = validRows.reduce((sum, row) => {
      const value = indicator.value(row)!;
      return sum + (finite(indicator.total?.(row)) ? indicator.total!(row)! : value * metricPoolArea(row, indicator.pool));
    }, 0);
    return { count: validRows.length, value: validArea > 0 ? total / validArea : null, total: validRows.length ? total : null };
  }
  if (indicator.key === "green_percent") {
    const area = rows.reduce((sum, row) => sum + (row.area_ha ?? 0), 0);
    const green = rows.reduce((sum, row) => sum + (row.green_area_ha ?? 0), 0);
    return { count: validRows.length, value: area > 0 ? (green / area) * 100 : null, total: null };
  }
  if (indicator.key === "coverage_percent") {
    const area = rows.reduce((sum, row) => sum + (row.area_ha ?? 0), 0);
    const valid = rows.reduce((sum, row) => sum + (row.valid_area_ha ?? 0), 0);
    return { count: validRows.length, value: area > 0 ? (valid / area) * 100 : null, total: null };
  }
  const total = validRows.reduce((sum, row) => sum + (indicator.value(row) ?? 0), 0);
  return { count: validRows.length, value: validRows.length ? total : null, total: null };
}

function FitMapBounds({ data }: { data: GeoJSON.FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(data).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });
  }, [data, map]);
  return null;
}

function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function GreenRankingsResultPanels({
  result,
  year,
  startMonth,
  endMonth,
  level,
  province,
  city,
  district,
}: {
  result: GreenRankingResult;
  year: number;
  startMonth: number;
  endMonth: number;
  level: string;
  province: string;
  city: string;
  district: string;
}) {
  const [indicatorKey, setIndicatorKey] = useState("green_percent");
  const [geometry, setGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [rows, setRows] = useState<GreenRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const selected = indicators.find((item) => item.key === indicatorKey) ?? indicators[0];
  const missingParent = level === "city" || level === "district" ? !province : level === "village" ? !district : false;
  const parentCode = level === "city" ? province : level === "district" ? city || province : level === "village" ? district : "";
  const parentEndpoint = level === "city" ? "province" : level === "district" ? (city ? "city" : "province") : "district";
  const childEndpoint = level === "city" ? "city" : level === "district" ? "district" : "village";
  const resultRunId = result.run_id;
  const resultProcessed = result.statistics.processed;
  const snapshotSavedAt = result.snapshot_saved_at;

  useEffect(() => {
    if (missingParent) {
      setGeometry(null);
      setRows([]);
      setLoadError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setGeometry(null);
    setRows([]);
    const fetchGeometry = level === "province"
      ? fetchProvinceGeometries(controller.signal)
      : apiClient.get<GeoJSON.FeatureCollection>(
          `/regions/children-geometries?${new URLSearchParams({ parent_code: parentCode, parent_endpoint: parentEndpoint, child_endpoint: childEndpoint, limit: "2000" })}`,
          { signal: controller.signal },
        );
    void Promise.all([
      fetchGeometry,
      loadAllRows(resultRunId, { year, startMonth, endMonth, level, province, city, district }, controller.signal),
    ])
      .then(([nextGeometry, nextRows]) => {
        if (controller.signal.aborted) return;
        setGeometry(nextGeometry);
        setRows(nextRows);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setGeometry(null);
        setRows([]);
        setLoadError(error instanceof Error ? error.message : "Data peta wilayah gagal dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [childEndpoint, city, district, endMonth, level, missingParent, parentCode, parentEndpoint, province, resultProcessed, resultRunId, snapshotSavedAt, startMonth, year]);

  const joined = useMemo<RankingCollection | null>(() => {
    if (!geometry) return null;
    const rowsByCode = new Map(rows.map((row) => [String(row.code), row]));
    const features: RankingFeature[] = geometry.features.flatMap((feature) => {
      const baseProps = (feature.properties ?? {}) as Record<string, unknown>;
      const code = String(baseProps.code ?? baseProps.KODE_PROV ?? baseProps.code_region ?? "");
      const row = rowsByCode.get(code);
      if (!row) return [];
      const value = selected.value(row);
      return [{
        ...feature,
        properties: {
          ...baseProps,
          code: row.code,
          name: row.name || String(baseProps.name ?? code),
          rank: row.rank,
          green_percent: row.green_percent,
          coverage_percent: row.coverage_percent,
          area_ha: row.area_ha,
          valid_area_ha: row.valid_area_ha,
          green_area_ha: row.green_area_ha,
          classes_ha: row.classes_ha,
          agb_mg_c_ha: row.agb_mg_c_ha,
          bgb_mg_c_ha: row.bgb_mg_c_ha,
          soc_mg_c_ha: row.soc_mg_c_ha,
          litter_mg_c_ha: row.litter_mg_c_ha,
          deadwood_mg_c_ha: row.deadwood_mg_c_ha,
          agb_total_mg_c: row.agb_total_mg_c,
          bgb_total_mg_c: row.bgb_total_mg_c,
          soc_total_mg_c: row.soc_total_mg_c,
          litter_total_mg_c: row.litter_total_mg_c,
          deadwood_total_mg_c: row.deadwood_total_mg_c,
          metric: selected.label,
          metric_unit: selected.unit,
          metric_value: finite(value) ? value : null,
          metric_total: selected.total?.(row) ?? null,
          pool_source: selected.pool ? row.carbon_pool_sources?.[selected.pool] ?? null : null,
          pool_sources: row.carbon_pool_sources ?? {},
        },
      } as RankingFeature];
    });
    return { type: "FeatureCollection", features };
  }, [geometry, rows, selected]);

  const values = useMemo(() => rows.map((row) => selected.value(row)).filter(finite).sort((a, b) => a - b), [rows, selected]);
  const quantiles = useMemo(() => [20, 40, 60, 80].map((percentile) => values[Math.min(values.length - 1, Math.floor((values.length * percentile) / 100))] ?? 0), [values]);
  const colorFor = (value: number | null) => {
    if (value == null) return "#d8dfdc";
    const bin = quantiles.findIndex((threshold) => value <= threshold);
    return colorRamp[bin < 0 ? colorRamp.length - 1 : bin];
  };
  const legend = useMemo(() => {
    const bins = colorRamp.map((color, index) => ({ color, values: values.filter((value) => (quantiles.findIndex((threshold) => value <= threshold) < 0 ? 4 : quantiles.findIndex((threshold) => value <= threshold)) === index) }));
    return bins.filter((bin) => bin.values.length > 0);
  }, [quantiles, values]);
  const summary = useMemo(() => metricSummary(rows, selected), [rows, selected]);
  const mappedCount = joined?.features.length ?? 0;

  const exportCsv = () => {
    const headers = ["kode", "wilayah", "peringkat", selected.key, "satuan", "total_pool_mg_c", "tutupan_hijau_persen", "cakupan_persen", "luas_ha", "luas_valid_ha", "resolusi_sumber_m", "cakupan_valid_persen", "sumber_pool", "tahun_sumber", "status_sumber"];
    const lines = rows.map((row) => {
      const source = selected.pool ? row.carbon_pool_sources?.[selected.pool] : undefined;
      return [row.code, row.name, row.rank, selected.value(row), selected.unit, selected.total?.(row), row.green_percent, row.coverage_percent, row.area_ha, source?.valid_area_ha ?? row.valid_area_ha, source?.resolution_m, source?.valid_coverage_percent, source?.name ?? source?.dataset, source?.source_year, source?.status]
        .map(csvCell).join(",");
    });
    downloadFile(`savegeo-peringkat-${selected.key}-${year}.csv`, `\uFEFF${[headers.map(csvCell).join(","), ...lines].join("\r\n")}`, "text/csv;charset=utf-8");
  };
  const exportGeoJson = () => {
    if (joined) downloadFile(`savegeo-peta-${selected.key}-${year}.geojson`, JSON.stringify(joined, null, 2), "application/geo+json;charset=utf-8");
  };

  return (
    <div className="green-rankings__result-panels">
      <CropPanelAccordion title="Peta hasil" icon="bi-globe-americas" className="green-rankings__accordion" defaultOpen>
        <div className="green-rankings__map-toolbar">
          <label className="green-rankings__metric-select">
            <span>Indikator peta</span>
            <select className="form-select" value={indicatorKey} onChange={(event) => setIndicatorKey(event.target.value)}>
              <optgroup label="Tutupan lahan">
                {indicators.filter((item) => item.kind !== "density").map((item) => <option value={item.key} key={item.key}>{item.label} ({item.unit})</option>)}
              </optgroup>
              <optgroup label="Karbon per pool">
                {indicators.filter((item) => item.kind === "density").map((item) => <option value={item.key} key={item.key}>{item.label} ({item.unit})</option>)}
              </optgroup>
            </select>
          </label>
          <span className="green-rankings__map-count">{mappedCount} wilayah terpetakan</span>
        </div>
        {missingParent ? (
          <div className="green-rankings__map-placeholder" role="status">
            <i className="bi bi-geo-alt" aria-hidden="true" />
            <span>{level === "city" ? "Pilih provinsi untuk memetakan kabupaten/kota." : level === "district" ? "Pilih provinsi untuk memetakan kecamatan; pilih kabupaten/kota untuk mempersempit peta." : "Pilih kecamatan untuk memetakan desa/kelurahan."}</span>
          </div>
        ) : (
          <>
            <div className="green-rankings__map-frame">
              <MapView id={`green-rankings-${selected.key}`} showGlobeControl={false} exportActions={["png", "print"]}>
                <BasemapSwitcher />
                {joined && <>
                  <FitMapBounds data={geometry!} />
                  <GeoJSON
                    key={`${selected.key}-${result.run_id}-${parentCode}-${result.statistics.processed}-${result.snapshot_saved_at ?? ""}`}
                    data={joined}
                    style={(feature) => {
                      const metricValue = feature?.properties?.metric_value;
                      const value = finite(metricValue) ? metricValue : null;
                      return { color: "#ffffff", weight: 0.8, opacity: 0.95, fillColor: colorFor(value), fillOpacity: value == null ? 0.3 : 0.82 };
                    }}
                    onEachFeature={(feature, layer) => {
                      const props = (feature.properties ?? {}) as Record<string, unknown>;
                      const tooltip = document.createElement("div");
                      const title = document.createElement("strong");
                      title.textContent = String(props.name ?? props.code ?? "Wilayah");
                      const value = document.createElement("div");
                      value.textContent = `${selected.label}: ${format(finite(props.metric_value) ? props.metric_value : null, selected.unit)}`;
                      const rank = document.createElement("small");
                      rank.textContent = props.rank == null ? `Kode ${String(props.code ?? "")}` : `Peringkat ${String(props.rank)} · Kode ${String(props.code ?? "")}`;
                      tooltip.append(title, value, rank);
                      if (props.pool_source && typeof props.pool_source === "object") {
                        const source = props.pool_source as Record<string, unknown>;
                        const method = document.createElement("small");
                        method.textContent = [source.name ?? source.dataset, source.source_year, source.status].filter((part) => part != null && part !== "").join(" · ");
                        if (method.textContent) tooltip.append(method);
                      }
                      layer.bindTooltip(tooltip, { sticky: true, direction: "auto" });
                    }}
                  />
                </>}
              </MapView>
              {loading && <div className="green-rankings__map-loading" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Memuat batas wilayah dan nilai snapshot…</div>}
              {!loading && loadError && <div className="green-rankings__map-error" role="alert">{loadError}</div>}
              {!loading && !loadError && joined && mappedCount === 0 && <div className="green-rankings__map-error" role="status">Belum ada batas wilayah yang cocok dengan hasil peringkat pada cakupan ini.</div>}
            </div>
            <div className="green-rankings__map-legend" aria-label={`Legenda ${selected.label}`}>
              <strong>{selected.label} ({selected.unit}) · rentang relatif</strong>
              {legend.length ? legend.map((bin, index) => <span key={index}><i style={{ background: bin.color }} />{format(bin.values[0], selected.unit)} – {format(bin.values[bin.values.length - 1], selected.unit)}</span>) : <small>Belum ada nilai untuk indikator ini.</small>}
              <small>Warna dibagi menurut kuantil wilayah yang tersedia; abu-abu berarti nilai kosong.</small>
            </div>
          </>
        )}
      </CropPanelAccordion>

      <CropPanelAccordion title="Statistik" icon="bi-bar-chart-line-fill" className="green-rankings__accordion" defaultOpen>
        <div className="green-rankings__result-stats">
          <article><span>Indikator</span><strong>{selected.label}</strong></article>
          <article><span>Wilayah dengan nilai</span><strong>{summary.count.toLocaleString("id-ID")}</strong></article>
          <article><span>{selected.kind === "density" ? "Densitas rata-rata berbobot luas" : selected.kind === "percent" ? "Nilai berbobot luas" : "Jumlah luas"}</span><strong>{format(summary.value, selected.unit)}</strong></article>
          {selected.kind === "density" && <article><span>Total karbon pada piksel valid</span><strong>{summary.total == null ? "—" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(summary.total)} Mg C`}</strong></article>}
        </div>
        <p className="green-rankings__result-note">Ringkasan dihitung dari snapshot wilayah yang sama dengan peta. Densitas karbon memakai total karbon dibagi luas valid; tidak diisi dari raster AOI.</p>
      </CropPanelAccordion>

      <CropPanelAccordion title="Ekspor hasil wilayah" icon="bi-download" className="green-rankings__accordion" defaultOpen>
        <div className="green-rankings__export-actions">
          <button type="button" className="btn btn-outline-success" disabled={!rows.length} onClick={exportCsv}><i className="bi bi-filetype-csv me-1" aria-hidden="true" />Unduh CSV indikator</button>
          <button type="button" className="btn btn-outline-success" disabled={!joined?.features.length} onClick={exportGeoJson}><i className="bi bi-geo me-1" aria-hidden="true" />Unduh GeoJSON peta</button>
          <span>PNG/PDF tersedia dari tombol unduh di pojok peta. Ekspor raster GeoTIFF tidak disediakan untuk agregat wilayah.</span>
        </div>
      </CropPanelAccordion>
    </div>
  );
}
