import { useEffect, useState } from "react";
import { fetchLandCoverDatasets } from "@/features/landcover/api";
import type { LandCoverDatasetCatalog, LandCoverParams } from "@/features/landcover/types";
import { canonicalLandCoverKeys, isPrimaryLandCover, landCoverChoices, PRIMARY_LULC_DATASETS } from "@/features/landcover/catalog";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";
import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  params: LandCoverParams;
  year: number;
  onParamsChange: (patch: Partial<LandCoverParams>) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function dateForYear(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Ported from module-carbon.html's #landcoverParams block. */
export default function LandCoverParamsPanel({ params, year, onParamsChange }: Props) {
  const { t, language } = useI18nStore();
  const text = (id: string, en: string) => language === "id" ? id : en;
  const [catalog, setCatalog] = useState<LandCoverDatasetCatalog>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const canonical = canonicalLandCoverKeys(params.datasets);
    if (canonical.join("|") !== params.datasets.join("|")) onParamsChange({ datasets: canonical });
  }, [params.datasets, onParamsChange]);

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
  const sources = datasetList.length ? datasetList : PRIMARY_LULC_DATASETS;
  const advancedSources = landCoverChoices(sources, true).filter((source) => !isPrimaryLandCover(source));
  const advancedKeys = new Set(advancedSources.map((source) => source.key));
  const hasAdvancedSelection = params.datasets.some((key) => advancedKeys.has(key));
  const showAdvancedToggle = advancedSources.length > 0;
  const datasetOptions = landCoverChoices(sources, (showAdvanced && showAdvancedToggle) || hasAdvancedSelection);
  const selectedSources = params.datasets.map((key) => catalog[key]).filter(Boolean);
  const dateMode = params.dateMode ?? "year";
  const selectedMonth = params.selectedMonth ?? params.startMonth;
  const startDate = params.startDate || dateForYear(year, 1, 1);
  const endDate = params.endDate || dateForYear(year, 12, 31);

  useEffect(() => {
    if (!Object.keys(catalog).length) return;
    const available = new Set(landCoverChoices(Object.values(catalog), true).map((source) => source.key));
    const valid = params.datasets.filter((key) => available.has(key));
    if (valid.length !== params.datasets.length) onParamsChange({ datasets: valid });
  }, [catalog, params.datasets, onParamsChange]);

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
        <div className="d-flex align-items-center justify-content-between mb-2">
          <label className="form-label mb-0" htmlFor="landcoverDatasetSelectSearch">{t("landcover.dataset")}</label>
          <div className="d-flex align-items-center gap-2">
            <InfoTip label={text("Info dataset LULC", "LULC dataset information")} content={text("Pilih beberapa sumber untuk membandingkan hasil. Resolusi, tahun, dan catatan akurasi tiap sumber tersedia melalui ikon info pada ringkasan pilihan.", "Select multiple sources to compare results. Resolution, years, and accuracy notes are available from the info icon for each selected source.")} />
            {showAdvancedToggle && <div className="form-check form-switch mb-0 d-flex align-items-center gap-1">
              <input id="lulc-advanced" type="checkbox" className="form-check-input mt-0" checked={showAdvanced || hasAdvancedSelection} disabled={hasAdvancedSelection} onChange={(event) => setShowAdvanced(event.target.checked)} />
              <label htmlFor="lulc-advanced" className="small text-muted">{text("Lanjutan", "Advanced")}</label>
              <InfoTip label={text("Info dataset lanjutan", "Advanced dataset information")} content={text("Hanya menampilkan model dan produk khusus yang saat ini tersedia. Keluaran RF referensi memakai label MapBiomas dan belum divalidasi independen secara lokal.", "Shows only currently available models and specialist products. Reference RF outputs use MapBiomas labels and have not been independently validated locally.")} />
            </div>}
          </div>
        </div>
        <SearchableMultiSelect
          id="landcoverDatasetSelectSearch"
          value={params.datasets}
          onChange={(datasets) => onParamsChange({ datasets })}
          options={datasetOptions.map((ds) => ({
            value: ds.key,
            label: ds.name,
            description: ds.resolution,
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
        {selectedSources.map((source) => <div className="lulc-source-summary" key={source.key}>
          <strong>{source.name}</strong>
          <span>{source.class_count} {text("kelas", "classes")} · {source.resolution} · {source.year_min}–{source.year_max} · {source.monthly ? text("Bulanan", "Monthly") : text("Tahunan", "Annual")}</span>
          <InfoTip label={text(`Info ${source.name}`, `${source.name} information`)} content={<>
            {source.description && <p>{source.description}</p>}
            {source.collection_version && <p>{text("Versi", "Version")}: {source.collection_version}</p>}
            {source.accuracy && <p>{source.accuracy}</p>}
            {source.supported_years && !source.supported_years.includes(year) && <p>{text(`Tahun ${year} belum tersedia pada sumber ini. Hasil akan memakai tahun terdekat yang didukung.`, `Year ${year} is not available for this source. Results will use the nearest supported year.`)}</p>}
            {source.limitations?.map((limitation) => <p key={limitation}>{limitation}</p>)}
          </>} />
        </div>)}
      </div>

      {params.datasets.some((key) => ["AlphaEarth_RF", "Sentinel1_2_RF", "Dynamic_World"].includes(key)) && <div className="mb-3">
        <div className="d-flex align-items-center gap-1 mb-1"><label className="form-label mb-0" htmlFor="landcover-confidence">{text("Ambang confidence (opsional)", "Confidence threshold (optional)")}</label><InfoTip label={text("Info confidence", "Confidence information")} content={text("Confidence RF adalah proporsi suara classifier, bukan nilai akurasi yang terkalibrasi.", "RF confidence is the classifier vote proportion, not a calibrated accuracy score.")} /></div>
        <input id="landcover-confidence" className="form-control" type="number" min={0} max={1} step={0.05} placeholder="0–1" value={params.confidenceThreshold ?? ""} onChange={(event) => onParamsChange({ confidenceThreshold: event.target.value === "" ? undefined : Number(event.target.value) })} />
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
