import { useEffect, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { listCarbonDatasets, listCarbonModels, getCarbonModelInfo } from "@/features/carbon/api";
import { getCloudMaskTechniques } from "@/features/vegetation/api";
import type { CloudMaskTechnique, CloudMaskTechniqueInfo } from "@/features/vegetation/types";
import { FALLBACK_CARBON_REFERENCE_DATASETS, CARBON_DATASET_YEARS } from "@/features/carbon/referenceDatasets";
import type {
  CarbonModelInfo,
  CarbonModelListItem,
  CarbonModelMeta,
  CarbonParams,
  CarbonReferenceDatasetOption,
  ClipMode,
} from "@/features/carbon/types";
import SearchableSelect from "@/components/ui/SearchableSelect";
import LocalCalibrationNotice from "./LocalCalibrationNotice";

interface Props {
  params: CarbonParams;
  onParamsChange: (patch: Partial<CarbonParams>) => void;
  selectedModel: CarbonModelListItem | null;
  onModelSelect: (model: CarbonModelListItem | null) => void;
}

function groupByAlgorithm(models: CarbonModelListItem[]) {
  const grouped: Record<string, CarbonModelListItem[]> = {};
  for (const m of models) {
    const algo = m.algorithm || "Other";
    (grouped[algo] ??= []).push(m);
  }
  return grouped;
}

function modelBadge(model: CarbonModelListItem): string {
  const meta = model.metadata_json;
  const isNonGeeStac = meta?.provider === "non_gee_stac" || meta?.provider === "local_raster";
  const isGee = !!meta?.gee_deployable;
  const geeType = meta?.gee_algorithm_type;
  const tag = isNonGeeStac
    ? " [non-GEE, STAC]"
    : !isGee
      ? " [stats only]"
      : geeType === "native_classifier"
        ? " ★GEE-RF"
        : " ★GEE";
  return tag + (meta?.preliminary ? " [PRELIMINARY]" : "");
}

function modelScore(model: CarbonModelListItem): number | undefined {
  return (
    model.metrics?.cv_metrics?.r2_mean ??
    model.metrics?.r2_mean ??
    model.metadata_json?.cv_metrics?.r2_mean ??
    (model.metadata_json?.spatial_cv_metrics as { r2_mean?: number } | undefined)?.r2_mean
  );
}

function modelDate(model: CarbonModelListItem): string | undefined {
  return model.uploaded_at ?? model.metadata_json?.trained_at;
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale);
}

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString(locale);
}

function compareModels(a: CarbonModelListItem, b: CarbonModelListItem): number {
  const geeRank = Number(Boolean(b.metadata_json?.gee_deployable)) - Number(Boolean(a.metadata_json?.gee_deployable));
  if (geeRank) return geeRank;
  const preliminaryRank = Number(Boolean(a.metadata_json?.preliminary)) - Number(Boolean(b.metadata_json?.preliminary));
  if (preliminaryRank) return preliminaryRank;
  const scoreA = modelScore(a) ?? Number.NEGATIVE_INFINITY;
  const scoreB = modelScore(b) ?? Number.NEGATIVE_INFINITY;
  if (scoreA !== scoreB) return scoreB - scoreA;
  const dateA = Date.parse(modelDate(a) ?? "") || 0;
  const dateB = Date.parse(modelDate(b) ?? "") || 0;
  if (dateA !== dateB) return dateB - dateA;
  return a.name.localeCompare(b.name);
}

type CompatibilityTone = "green" | "gray" | "orange";

function compatibilityInfo(
  t: (key: string) => string,
  meta?: CarbonModelMeta,
  algorithm?: string,
): { text: string; tone: CompatibilityTone } {
  if (!meta) return { text: "N/A", tone: "gray" };
  if (meta.provider === "non_gee_stac" || meta.provider === "local_raster") {
    return { text: t("carbon.params.compat.nonGeeStac"), tone: "gray" };
  }
  if (!meta.gee_deployable) return { text: t("carbon.params.compat.statsOnly"), tone: "gray" };
  if (meta.gee_algorithm_type === "native_classifier") return { text: t("carbon.params.compat.geeNative"), tone: "green" };
  if (meta.gee_algorithm_type === "linear_expression") return { text: t("carbon.params.compat.geeDirect"), tone: "green" };
  // Older models predate `gee_algorithm_type` — infer linear-direct from algorithm name.
  const algo = (algorithm || meta.algorithm || "").toLowerCase();
  if (/^(ridge|lasso|linear|elastic_net)/.test(algo)) return { text: t("carbon.params.compat.geeDirect"), tone: "green" };
  return { text: t("carbon.params.compat.requiresSurrogate"), tone: "orange" };
}

/**
 * Ported from module-carbon.html's #carbonParams block + main.js
 * loadAvailableModels()/displayModelInfo()/updateDatasetDescription().
 */
export default function CarbonParamsPanel({
  params,
  onParamsChange,
  selectedModel,
  onModelSelect,
}: Props) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const locale = language === "id" ? "id-ID" : "en-US";
  const [models, setModels] = useState<CarbonModelListItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<CarbonModelInfo | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [datasets, setDatasets] = useState<CarbonReferenceDatasetOption[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [techniques, setTechniques] = useState<Record<string, CloudMaskTechniqueInfo>>({});

  useEffect(() => {
    let cancelled = false;
    getCloudMaskTechniques()
      .then((res) => {
        if (cancelled || !res?.techniques) return;
        setTechniques(res.techniques);
      })
      .catch(() => {
        /* technique picker just won't render options; backend still defaults to SCL */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDatasetsLoading(true);
    setDatasetsError(null);
    listCarbonDatasets()
      .then((list) => {
        if (cancelled) return;
        setDatasets(list);
        if (list.length > 0 && !list.some((d) => d.value === params.referenceDataset)) {
          onParamsChange({ referenceDataset: list[0].value });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDatasets(FALLBACK_CARBON_REFERENCE_DATASETS.map((d) => ({ ...d, source: "fallback" })));
        setDatasetsError(t("carbon.params.datasetLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-dataset year options: prefer the selected dataset's own `year`/
  // `yearRange` from the live catalog (e.g. WCMC is 2010-only, GEDI is
  // 2019-2023) over the flat CARBON_DATASET_YEARS fallback, which offered
  // the same year list regardless of which dataset was picked.
  const selectedDatasetMeta = datasets.find((d) => d.value === params.referenceDataset);
  const yearOptions = (() => {
    const meta = selectedDatasetMeta;
    if (meta?.yearRange) {
      if (Array.isArray(meta.yearRange) && meta.yearRange.length === 2) {
        const [start, end] = meta.yearRange;
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          const years: number[] = [];
          for (let y = end; y >= start; y--) years.push(y);
          return years;
        }
      }
    }
    if (meta?.year != null && Number.isFinite(Number(meta.year))) {
      return [Number(meta.year)];
    }
    return CARBON_DATASET_YEARS;
  })();

  useEffect(() => {
    if (!yearOptions.length) return;
    if (!yearOptions.includes(params.datasetYear)) {
      onParamsChange({ datasetYear: yearOptions[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.referenceDataset, datasets]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    listCarbonModels(params.referenceDataset)
      .then((list) => {
        if (cancelled) return;
        const orderedModels = [...list].sort(compareModels);
        setModels(orderedModels);
        const first = orderedModels[0] || null;
        if (first) {
          onModelSelect(first);
          onParamsChange({ modelName: first.name });
        } else {
          onModelSelect(null);
          onParamsChange({ modelName: null });
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.referenceDataset]);

  useEffect(() => {
    if (!params.modelName) {
      setModelInfo(null);
      return;
    }
    let cancelled = false;
    getCarbonModelInfo(params.modelName)
      .then((info) => {
        if (!cancelled) setModelInfo(info ?? null);
      })
      .catch(() => {
        if (!cancelled) setModelInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params.modelName]);

  const datasetMeta = datasets.find((d) => d.value === params.referenceDataset);
  const grouped = groupByAlgorithm(models);
  const geeCount = models.filter((m) => m.metadata_json?.gee_deployable).length;

  const cv = modelInfo?.cv_metrics || modelInfo?.metrics?.cv_metrics;

  return (
    <div id="carbonParams">
      <h6 className="mb-3">
        <i className="bi bi-tree me-1" /> {t("carbon.params.title")}
      </h6>
      <div className="alert alert-info py-2">
        <small>
          <i className="bi bi-info-circle me-1" />
          {t("carbon.params.intro")}
        </small>
      </div>

      <div className="mb-3">
        <label className="form-label">
          <i className="bi bi-database me-1" /> {t("carbon.params.referenceDataset")}
        </label>
        <SearchableSelect
          value={params.referenceDataset}
          onChange={(v) => onParamsChange({ referenceDataset: v })}
          options={datasets.map((d) => ({
            value: d.value,
            label: d.label,
            description:
              d.requiresConfiguration && d.isConfigured === false
                ? `${d.group} - perlu konfigurasi`
                : d.compatibleModelCount !== undefined
                  ? `${d.group} - ${d.compatibleModelCount} model compatible`
                  : d.group,
          }))}
          placeholder={t("carbon.params.referenceDatasetPlaceholder")}
          loading={datasetsLoading}
          disabled={datasetsLoading || datasets.length === 0}
        />
        <select
          id="carbonReferenceDataset"
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          value={params.referenceDataset}
          onChange={(e) => onParamsChange({ referenceDataset: e.target.value })}
        >
          {datasets.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {datasetMeta?.requiresConfiguration && datasetMeta.isConfigured === false && (
          <small className="text-warning d-block mt-1">
            <i className="bi bi-exclamation-triangle me-1" />
            {datasetMeta.availabilityError || "Dataset ini perlu konfigurasi server-side sebelum bisa dimuat."}
          </small>
        )}
        {datasetsError && (
          <small className="text-warning d-block mt-1">
            <i className="bi bi-exclamation-triangle me-1" />
            {datasetsError}
          </small>
        )}
        {!datasetsLoading && datasets.length === 0 && (
          <small className="text-muted d-block mt-1">{t("carbon.params.noDatasets")}</small>
        )}
        {datasetMeta && (
          <small className="text-muted d-block mt-1">
            <i className="bi bi-info-circle me-1" />
            {datasetMeta.description}
          </small>
        )}
      </div>

      <LocalCalibrationNotice />

      <div className="mb-3">
        <label className="form-label">
          <i className="bi bi-cpu me-1" /> {t("carbon.params.trainedModel")}
        </label>
        <div className="alert alert-info py-2 mb-2">
          <small>
            <i className="bi bi-info-circle me-1" />
            {t("carbon.params.modelIntro")}
          </small>
        </div>
        <SearchableSelect
          value={params.modelName ?? ""}
          onChange={(v) => {
            const name = v || null;
            onParamsChange({ modelName: name });
            onModelSelect(models.find((m) => m.name === name) ?? null);
          }}
          options={Object.entries(grouped).flatMap(([algo, list]) =>
            list.map((m) => {
              const score = modelScore(m);
              const date = formatDate(modelDate(m), locale);
              const descParts = [date, score !== undefined ? `R²: ${score.toFixed(3)}` : null].filter(
                Boolean,
              );
              return {
                value: m.name,
                label: `${m.name}${modelBadge(m)}`,
                description: descParts.join(" · "),
                group: algo.toUpperCase(),
              };
            }),
          )}
          placeholder={t("carbon.params.modelPlaceholder")}
          loading={modelsLoading}
          disabled={modelsLoading}
        />
        <select
          id="carbonModelSelect"
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          value={params.modelName ?? ""}
          onChange={(e) => {
            const name = e.target.value || null;
            onParamsChange({ modelName: name });
            onModelSelect(models.find((m) => m.name === name) ?? null);
          }}
        >
          <option value="">{t("carbon.params.modelPlaceholder")}</option>
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <small className="text-muted d-block mt-1">
          {models.length > 0 ? (
            <>
              <i className="bi bi-check-circle text-success me-1" />
              {models.length} {t("carbon.params.modelCountSuffix")} {params.referenceDataset}
              {geeCount > 0 ? ` (${geeCount} ${t("carbon.params.modelCountGeeReady")})` : ` - ${t("carbon.params.modelCountNoTiles")}`}
            </>
          ) : !modelsLoading ? (
            <>
              <i className="bi bi-exclamation-triangle text-warning me-1" />
              {t("carbon.params.noModelsForDataset")}
            </>
          ) : null}
        </small>

        {selectedModel && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary mt-2"
            onClick={() => setShowModelInfo((s) => !s)}
          >
            <i className="bi bi-info-circle me-1" /> {showModelInfo ? t("carbon.params.hideDetail") : t("carbon.params.viewDetail")} {t("carbon.params.modelDetail")}
          </button>
        )}
        {showModelInfo && modelInfo && (
          <div className="cm-detail-card mt-2">
            <div className="cm-detail-title">
              <i className="bi bi-info-circle" /> {t("carbon.params.modelDetail")}
            </div>
            <div className="cm-detail-grid">
              <div className="cm-detail-label">{t("carbon.params.detail.name")}</div>
              <div className="cm-detail-value cm-detail-mono">
                {modelInfo.name || params.modelName || "N/A"}
              </div>

              <div className="cm-detail-label">{t("carbon.params.detail.algorithm")}</div>
              <div className="cm-detail-value">
                {modelInfo.algorithm || modelInfo.metadata_json?.algorithm || "N/A"}
              </div>

              <div className="cm-detail-label">{t("carbon.params.detail.trained")}</div>
              <div className="cm-detail-value">
                {formatDateTime(
                  modelInfo.trained_at ?? modelInfo.metadata_json?.trained_at ?? modelInfo.metrics?.trained_at,
                  locale,
                )}
              </div>

              <div className="cm-detail-label">{t("carbon.params.detail.samples")}</div>
              <div className="cm-detail-value">
                {modelInfo.n_samples ?? modelInfo.metrics?.n_samples ?? "N/A"}
              </div>

              <div className="cm-detail-label">{t("carbon.params.detail.version")}</div>
              <div className="cm-detail-value">{modelInfo.version || "N/A"}</div>

              <div className="cm-detail-label">{t("carbon.params.detail.compatibility")}</div>
              <div className="cm-detail-value">
                {(() => {
                  const c = compatibilityInfo(
                    t,
                    modelInfo.metadata_json,
                    modelInfo.algorithm ?? modelInfo.metadata_json?.algorithm,
                  );
                  return <span className={`cm-badge cm-badge-${c.tone}`}>{c.text}</span>;
                })()}
              </div>

              {cv && (
                <>
                  <div className="cm-detail-label">{t("carbon.params.detail.cvFolds")}</div>
                  <div className="cm-detail-value">{cv.n_folds ?? cv.cv_folds ?? "N/A"}</div>

                  <div className="cm-detail-label">{t("carbon.params.detail.meanRmse")}</div>
                  <div className="cm-detail-value">{cv.rmse_mean?.toFixed?.(2) ?? "N/A"}</div>

                  <div className="cm-detail-label">{t("carbon.params.detail.meanR2")}</div>
                  <div className="cm-detail-value">{cv.r2_mean?.toFixed?.(3) ?? "N/A"}</div>
                </>
              )}
            </div>

            {(() => {
              const fi = modelInfo.feature_importance ?? modelInfo.metadata_json?.feature_importance;
              const top = fi ? Object.entries(fi).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
              if (top.length === 0) return null;
              const max = top[0][1] || 1;
              return (
                <div className="cm-detail-features">
                  <div className="cm-detail-label mb-1">{t("carbon.params.detail.topFeatures")}</div>
                  {top.map(([name, val]) => (
                    <div key={name} className="cm-feature-row">
                      <span className="cm-feature-name">{name}</span>
                      <span className="cm-feature-bar-track">
                        <span
                          className="cm-feature-bar-fill"
                          style={{ width: `${Math.max(4, (val / max) * 100)}%` }}
                        />
                      </span>
                      <span className="cm-feature-val">{val.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">{t("carbon.params.datasetYear")}</label>
        <select
          className="form-select"
          id="carbonDatasetYear"
          value={params.datasetYear}
          onChange={(e) => onParamsChange({ datasetYear: Number(e.target.value) })}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">{t("carbon.params.dateRange")}</label>
        <div className="d-flex gap-2 align-items-center">
          <select
            className="form-select"
            id="carbonStartMonth"
            value={params.startMonth}
            onChange={(e) => onParamsChange({ startMonth: Number(e.target.value) })}
          >
            {MONTHS.map((_m, i) => (
              <option key={i + 1} value={i + 1}>
                {t(`carbon.params.months.${i + 1}`)}
              </option>
            ))}
          </select>
          <span className="text-muted">{t("carbon.params.dateRangeSep")}</span>
          <select
            className="form-select"
            id="carbonEndMonth"
            value={params.endMonth}
            onChange={(e) => onParamsChange({ endMonth: Number(e.target.value) })}
          >
            {MONTHS.map((_m, i) => (
              <option key={i + 1} value={i + 1}>
                {t(`carbon.params.months.${i + 1}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">{t("carbon.params.cloudThreshold")}</label>
        <input
          id="carbonCloudSlider"
          type="range"
          className="form-range"
          min={0}
          max={30}
          value={params.cloudThreshold}
          onChange={(e) => onParamsChange({ cloudThreshold: Number(e.target.value) })}
        />
        <div className="text-center">
          <strong>{params.cloudThreshold}</strong>%
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">{t("carbon.params.cloudTechnique")}</label>
        <select
          className="form-select"
          value={params.cloudMaskTechnique}
          onChange={(e) => onParamsChange({ cloudMaskTechnique: e.target.value as CloudMaskTechnique })}
          disabled={Object.keys(techniques).length === 0}
        >
          {Object.entries(techniques).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
        {techniques[params.cloudMaskTechnique] && (
          <small className="text-muted d-block mt-1">{techniques[params.cloudMaskTechnique].description}</small>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">
          <i className="bi bi-scissors me-1" /> {t("carbon.params.displayMode")}
        </label>
        <div className="btn-group w-100" role="group">
          {(["clipped", "full"] as ClipMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn ${params.clipMode === mode ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => onParamsChange({ clipMode: mode })}
            >
              <i className={`bi ${mode === "clipped" ? "bi-scissors" : "bi-layers"} me-1`} />
              {mode === "clipped" ? t("carbon.params.clipped") : t("carbon.params.fullTiles")}
            </button>
          ))}
        </div>
        <small className="text-muted d-block mt-1">
          <i className="bi bi-info-circle me-1" />
          {params.clipMode === "clipped" ? t("carbon.params.clippedDesc") : t("carbon.params.fullTilesDesc")}
        </small>
      </div>

      <div className="form-check mb-2">
        <input
          className="form-check-input"
          type="checkbox"
          id="showReference"
          checked={params.showReference}
          onChange={(e) => onParamsChange({ showReference: e.target.checked })}
        />
        <label className="form-check-label" htmlFor="showReference">
          <i className="bi bi-database me-1" /> {t("carbon.params.showReference")}
        </label>
        <small className="text-muted d-block ms-4">
          Peta referensi asli ditampilkan sebagai layer pembanding, terpisah dari prediksi model.
        </small>
      </div>
    </div>
  );
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
