import { useEffect, useState } from "react";
import { fetchLandCoverDatasets } from "@/features/landcover/api";
import type { LandCoverDatasetCatalog, LandCoverDatasetOption, LandCoverParams } from "@/features/landcover/types";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";
import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  params: LandCoverParams;
  year: number;
  onParamsChange: (patch: Partial<LandCoverParams>) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const FALLBACK_LULC_DATASETS: LandCoverDatasetOption[] = [
  { key: "Dynamic_World", name: "Dynamic World", resolution: "10m" },
  {
    key: "GeoSave_Copernicus_DynamicWorld",
    name: "GeoSave Copernicus Sentinel-2 Land Cover",
    resolution: "10m",
  },
  { key: "ESA_WorldCover", name: "ESA WorldCover", resolution: "10m" },
  {
    key: "ESRI_LandCover",
    name: "ESRI 10m Annual LULC v3 (GEE Community Catalog)",
    resolution: "10m",
  },
  {
    key: "ESRI_LULC_LivingAtlas",
    name: "Esri Sentinel-2 10m LULC Time Series (ArcGIS Living Atlas)",
    resolution: "10m",
  },
  { key: "MODIS_LandCover", name: "MODIS MCD12Q1 IGBP", resolution: "500m" },
  { key: "Copernicus_LandCover", name: "Copernicus Global Land Cover", resolution: "100m" },
  { key: "GLC_FCS30D", name: "GLC_FCS30D", resolution: "30m" },
  { key: "C3S_LandCover", name: "C3S Land Cover", resolution: "300m" },
  {
    key: "JAXA_FNF",
    name: "JAXA ALOS Forest/Non-Forest",
    resolution: "25m",
    deprecated: true,
    replacement_key: "JAXA_FNF4",
  },
  { key: "JAXA_FNF4", name: "JAXA PALSAR Forest/Non-Forest 4-class", resolution: "25m" },
  { key: "MapBiomas_Indonesia", name: "MapBiomas Indonesia LANDY", resolution: "30m" },
  {
    key: "GeoSave_MapBiomas_Indonesia",
    name: "GeoSave MapBiomas Indonesia LANDY",
    resolution: "30m",
  },
  {
    key: "DEA_Mangroves",
    name: "Digital Earth Australia Mangroves Landsat (ArcGIS Living Atlas)",
    resolution: "25m",
  },
  { key: "JRC_TMF", name: "JRC Tropical Moist Forest Annual Changes v1 2022", resolution: "30m" },
  {
    key: "FROM_GLC10",
    name: "Tsinghua FROM-GLC 10m Global Land Cover 2017",
    resolution: "10m",
    deprecated: true,
    replacement_key: "ESRI_LandCover",
  },
  {
    key: "GLAD_GLCLUC",
    name: "GLAD Annual Global Land Use/Land Cover (Potapov et al. 2022)",
    resolution: "30m",
  },
];

function dateForYear(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Ported from module-carbon.html's #landcoverParams block. */
export default function LandCoverParamsPanel({ params, year, onParamsChange }: Props) {
  const { t, language } = useI18nStore();
  const text = (id: string, en: string) => language === "id" ? id : en;
  const [catalog, setCatalog] = useState<LandCoverDatasetCatalog>({});

  useEffect(() => {
    let cancelled = false;
    fetchLandCoverDatasets()
      .then((res) => {
        if (!cancelled && res) setCatalog(res);
      })
      .catch(() => {
        /* dataset picker falls back to no options; user sees empty select */
      });
    return () => { cancelled = true; };
  }, []);

  const datasetList = Object.values(catalog);
  const datasetOptions = (datasetList.length ? datasetList : FALLBACK_LULC_DATASETS).filter((item) => item.available !== false);
  const selectedSources = params.datasets.map((key) => catalog[key]).filter(Boolean);
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
        <i className="bi bi-map me-1" /> {t("landcover.title")}
      </h6>

      <div className="mb-3">
        <label className="form-label">{t("landcover.dataset")}</label>
        <SearchableMultiSelect
          id="landcoverDatasetSelectSearch"
          value={params.datasets}
          onChange={(datasets) => onParamsChange({ datasets })}
          options={datasetOptions.map((ds) => ({
            value: ds.key,
            label: ds.deprecated ? `${ds.name} · legacy` : ds.name,
            description: ds.deprecated && ds.replacement_key
              ? `Legacy — gunakan ${ds.replacement_key}`
              : ds.alias_of
                ? `Adapter untuk ${ds.alias_of}`
                : ds.resolution
                  ? `Resolusi ${ds.resolution}`
                  : undefined,
          }))}
          placeholder={t("landcover.searchPlaceholder")}
          emptyHint={t("landcover.empty")}
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
              {ds.name}
              {ds.resolution ? ` (${ds.resolution})` : ""}
            </option>
          ))}
        </select>
        <small className="text-muted d-block mt-1">
          {t("landcover.selected", { count: params.datasets.length })}
        </small>
        {selectedSources.map((source) => <div className="border rounded p-2 small mt-2" key={source.key}>
          <strong>{source.name}</strong><div>{source.class_count} {text("kelas", "classes")} · {source.resolution} · {source.year_min}–{source.year_max} · {source.coverage}</div>
          {source.collection_version && <div>{text("Versi", "Version")}: {source.collection_version}</div>}
          <div>{source.monthly ? text("Mendukung periode bulan/tanggal.", "Supports month/date periods.") : text("Produk tahunan; pilihan bulan tidak mengubah raster sumber.", "Annual product; month selection does not change the source raster.")}</div>
          {source.supported_years && !source.supported_years.includes(year) && <div className="text-warning">{text("Tahun pilihan belum tersedia. Periksa tahun efektif pada hasil.", "The selected year is unavailable. Check the effective year in the result.")}</div>}
          {source.accuracy && <div className="text-muted">{source.accuracy}</div>}
        </div>)}
        {datasetList.some((source) => source.available === false) && <details className="small mt-2"><summary>{text("Model yang memerlukan konfigurasi", "Models needing configuration")}</summary>
          {datasetList.filter((source) => source.available === false).map((source) => <p key={source.key} className="mb-1">{source.name}: {source.availability_reason}</p>)}
          <a href="/admin/ml-models">{text("Konfigurasi model di Admin", "Configure models in Admin")}</a>
        </details>}
      </div>

      {params.datasets.some((key) => ["AlphaEarth_RF", "Sentinel1_2_RF", "Dynamic_World"].includes(key)) && <div className="mb-3">
        <label className="form-label" htmlFor="landcover-confidence">{text("Ambang confidence (opsional)", "Confidence threshold (optional)")}</label>
        <input id="landcover-confidence" className="form-control" type="number" min={0} max={1} step={0.05} placeholder="0–1" value={params.confidenceThreshold ?? ""} onChange={(event) => onParamsChange({ confidenceThreshold: event.target.value === "" ? undefined : Number(event.target.value) })} />
        <small className="text-muted">{text("Confidence RF adalah proporsi suara dan belum dikalibrasi sebagai akurasi.", "RF confidence is a vote proportion and has not been calibrated as accuracy.")}</small>
      </div>}

      <div className="mb-3">
        <label className="form-label">{t("landcover.dwMode")}</label>
        <select
          className="form-select"
          value={params.dwMode}
          onChange={(e) => onParamsChange({ dwMode: e.target.value as LandCoverParams["dwMode"] })}
        >
          <option value="mode">{t("landcover.modeMostFrequent")}</option>
          <option value="hillshade">{t("landcover.hillshade")}</option>
          <option value="probability">{t("landcover.probability")}</option>
        </select>
      </div>

      <div className="carbon-help-toggle-row form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="includeImprobableClasses"
          checked={params.includeImprobableClasses}
          onChange={(e) => onParamsChange({ includeImprobableClasses: e.target.checked })}
        />
        <label className="form-check-label" htmlFor="includeImprobableClasses">
          {t("landcover.includeRare")}
        </label>
        <InfoTip label={t("carbon.params.moreInfo")} content={t("landcover.includeRareHint")} />
      </div>

      <div className="mb-3">
        <div className="carbon-info-label">
          <label className="form-label">{t("landcover.dateMode")}</label>
          {dateMode === "date" && <InfoTip label={t("carbon.params.moreInfo")} content={t("landcover.dateSpecificHint")} />}
        </div>
        <div className="btn-group w-100" role="group" aria-label="Mode tanggal analisis LULC">
          {(["year", "month", "date"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-sm ${dateMode === mode ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setDateMode(mode)}
            >
              <i className="bi bi-calendar-event me-1" />
              {mode === "year" ? t("landcover.year") : mode === "month" ? t("landcover.month") : t("landcover.date")}
            </button>
          ))}
        </div>
      </div>

      {dateMode === "year" && (
        <div className="mb-3">
          <div className="carbon-info-label">
            <label className="form-label">
              {t("landcover.monthRange")} <span className="text-muted">(Dynamic World)</span>
            </label>
            <InfoTip label={t("carbon.params.moreInfo")} content={t("landcover.fullYearHint")} />
          </div>
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
        </div>
      )}

      {dateMode === "month" && (
        <div className="mb-3">
          <div className="carbon-info-label">
            <label className="form-label">{t("landcover.selectMonth")}</label>
            <InfoTip label={t("carbon.params.moreInfo")} content={t("landcover.monthHint")} />
          </div>
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
        </div>
      )}

      {dateMode === "date" && (
        <div className="mb-3">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">{t("landcover.fromDate")}</label>
              <input
                id="lcStartDate"
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => onParamsChange({ startDate: e.target.value })}
              />
            </div>
            <div className="col-6">
              <label className="form-label">{t("landcover.toDate")}</label>
              <input
                id="lcEndDate"
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => onParamsChange({ endDate: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
