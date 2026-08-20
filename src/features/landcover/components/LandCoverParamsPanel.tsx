import { useEffect, useState } from "react";
import { fetchLandCoverDatasets } from "@/features/landcover/api";
import type { LandCoverDatasetCatalog, LandCoverParams } from "@/features/landcover/types";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";

interface Props {
  params: LandCoverParams;
  year: number;
  onParamsChange: (patch: Partial<LandCoverParams>) => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const FALLBACK_LULC_DATASETS = [
  { key: "Dynamic_World", name: "Dynamic World", resolution: "10m" },
  { key: "ESA_WorldCover", name: "ESA WorldCover", resolution: "10m" },
  { key: "ESRI_LandCover", name: "ESRI 10m Annual LULC v3 (GEE Community Catalog)", resolution: "10m" },
  { key: "ESRI_LULC_LivingAtlas", name: "Esri Sentinel-2 10m LULC Time Series (ArcGIS Living Atlas)", resolution: "10m" },
  { key: "MODIS_LandCover", name: "MODIS MCD12Q1 IGBP", resolution: "500m" },
  { key: "Copernicus_LandCover", name: "Copernicus Global Land Cover", resolution: "100m" },
  { key: "GLC_FCS30D", name: "GLC_FCS30D", resolution: "30m" },
  { key: "C3S_LandCover", name: "C3S Land Cover", resolution: "300m" },
  { key: "JAXA_FNF", name: "JAXA ALOS Forest/Non-Forest", resolution: "25m" },
  { key: "JAXA_FNF4", name: "JAXA PALSAR Forest/Non-Forest 4-class", resolution: "25m" },
  { key: "MapBiomas_Indonesia", name: "MapBiomas Indonesia LANDY", resolution: "30m" },
  { key: "DEA_Mangroves", name: "Digital Earth Australia Mangroves Landsat (ArcGIS Living Atlas)", resolution: "25m" },
  { key: "JRC_TMF", name: "JRC Tropical Moist Forest Annual Changes v1 2022", resolution: "30m" },
  { key: "FROM_GLC10", name: "Tsinghua FROM-GLC 10m Global Land Cover 2017", resolution: "10m" },
  { key: "GLAD_GLCLUC", name: "GLAD Annual Global Land Use/Land Cover (Potapov et al. 2022)", resolution: "30m" },
];

function dateForYear(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Ported from module-carbon.html's #landcoverParams block. */
export default function LandCoverParamsPanel({ params, year, onParamsChange }: Props) {
  const [catalog, setCatalog] = useState<LandCoverDatasetCatalog>({});

  useEffect(() => {
    fetchLandCoverDatasets()
      .then((res) => {
        if (res) setCatalog(res);
      })
      .catch(() => {
        /* dataset picker falls back to no options; user sees empty select */
      });
  }, []);

  const datasetList = Object.values(catalog);
  const datasetOptions = datasetList.length ? datasetList : FALLBACK_LULC_DATASETS;
  const dateMode = params.dateMode ?? "year";
  const selectedMonth = params.selectedMonth ?? params.startMonth;
  const startDate = params.startDate || dateForYear(year, 1, 1);
  const endDate = params.endDate || dateForYear(year, 12, 31);

  const setDateMode = (mode: LandCoverParams["dateMode"]) => {
    if (mode === "month") {
      onParamsChange({ dateMode: mode, selectedMonth });
      return;
    }
    if (mode === "date") {
      onParamsChange({ dateMode: mode, startDate, endDate });
      return;
    }
    onParamsChange({ dateMode: mode });
  };

  return (
    <div id="landcoverParams">
      <h6 className="mb-3">
        <i className="bi bi-map me-1" /> Dataset Tutupan Lahan
      </h6>

      <div className="mb-3">
        <label className="form-label">Dataset LULC</label>
        <SearchableMultiSelect
          id="landcoverDatasetSelectSearch"
          value={params.datasets}
          onChange={(datasets) => onParamsChange({ datasets })}
          options={datasetOptions.map((ds) => ({
            value: ds.key,
            label: ds.name,
            description: ds.resolution ? `Resolusi ${ds.resolution}` : undefined,
          }))}
          placeholder="Cari dataset LULC..."
          emptyHint="Dataset LULC tidak ditemukan"
        />
        <select
          id="landcoverDatasetSelect"
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          multiple
          value={params.datasets}
          onChange={(e) =>
            onParamsChange({
              datasets: Array.from(e.currentTarget.selectedOptions).map((opt) => opt.value),
            })
          }
        >
          {datasetOptions.map((ds) => (
            <option key={ds.key} value={ds.key}>
              {ds.name}{ds.resolution ? ` (${ds.resolution})` : ""}
            </option>
          ))}
        </select>
        <small className="text-muted d-block mt-1">
          Pilih satu atau beberapa dataset LULC. Terpilih: {params.datasets.length}.
        </small>
      </div>

      <div className="mb-3">
        <label className="form-label">Mode Dynamic World</label>
        <select
          className="form-select"
          value={params.dwMode}
          onChange={(e) =>
            onParamsChange({ dwMode: e.target.value as LandCoverParams["dwMode"] })
          }
        >
          <option value="mode">Mode (Paling Sering)</option>
          <option value="hillshade">Hillshade</option>
          <option value="probability">Probability</option>
        </select>
      </div>

      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="includeImprobableClasses"
          checked={params.includeImprobableClasses}
          onChange={(e) => onParamsChange({ includeImprobableClasses: e.target.checked })}
        />
        <label className="form-check-label" htmlFor="includeImprobableClasses">
          Tampilkan kelas langka/tidak relevan tropis
          <small className="text-muted d-block">
            Contoh: Snow/Ice. Default disembunyikan untuk AOI Indonesia.
          </small>
        </label>
      </div>

      <div className="mb-3">
        <label className="form-label">Mode Tanggal Analisis</label>
        <div className="btn-group w-100" role="group" aria-label="Mode tanggal analisis LULC">
          {(["year", "month", "date"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-sm ${dateMode === mode ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setDateMode(mode)}
            >
              <i className="bi bi-calendar-event me-1" />
              {mode === "year" ? "Tahun" : mode === "month" ? "Bulan" : "Tanggal"}
            </button>
          ))}
        </div>
      </div>

      {dateMode === "year" && (
        <div className="mb-3">
          <label className="form-label">Rentang Bulan <span className="text-muted">(Dynamic World)</span></label>
          <div className="d-flex gap-2">
            <select
              className="form-select"
              id="lcStartMonth"
              value={params.startMonth}
              onChange={(e) => onParamsChange({ startMonth: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <span className="align-self-center">s/d</span>
            <select
              className="form-select"
              id="lcEndMonth"
              value={params.endMonth}
              onChange={(e) => onParamsChange({ endMonth: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <small className="text-muted">Dataset tahunan menggunakan tahun penuh yang dipilih.</small>
        </div>
      )}

      {dateMode === "month" && (
        <div className="mb-3">
          <label className="form-label">Pilih Bulan</label>
          <select
            className="form-select"
            id="lcSelectedMonth"
            value={selectedMonth}
            onChange={(e) => onParamsChange({ selectedMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <small className="text-muted d-block mt-1">
            Dynamic World difilter per bulan. Dataset tahunan menggunakan tahun dari slider di atas.
          </small>
        </div>
      )}

      {dateMode === "date" && (
        <div className="mb-3">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">Dari Tanggal</label>
              <input
                id="lcStartDate"
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => onParamsChange({ startDate: e.target.value })}
              />
            </div>
            <div className="col-6">
              <label className="form-label">Sampai Tanggal</label>
              <input
                id="lcEndDate"
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => onParamsChange({ endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="alert alert-info py-2 px-2 mt-2 mb-0 small">
            <i className="bi bi-info-circle me-1" />
            <strong>Dynamic World</strong> mendukung tanggal spesifik. Dataset tahunan menggunakan tahun dari tanggal mulai.
          </div>
        </div>
      )}
    </div>
  );
}
