import { useEffect, useMemo, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { listCarbonDatasets, listCarbonModels, getCarbonModelInfo } from "@/features/carbon/api";
import { getCloudMaskTechniques } from "@/features/vegetation/api";
import type { CloudMaskTechnique, CloudMaskTechniqueInfo } from "@/features/vegetation/types";
import {
  DEFAULT_CARBON_REFERENCE_DATASET,
  FALLBACK_CARBON_REFERENCE_DATASETS,
  carbonDatasetYearOptions,
  availableCarbonReferenceDatasets,
  resolveCarbonReferenceDataset,
} from "@/features/carbon/referenceDatasets";
import type {
  CarbonModelInfo,
  CarbonModelListItem,
  CarbonModelMeta,
  CarbonParams,
  CarbonReferenceDatasetOption,
  ClipMode,
} from "@/features/carbon/types";
import SearchableSelect from "@/components/ui/SearchableSelect";
import InfoTip from "@/components/ui/InfoTip";

interface Props {
  params: CarbonParams;
  onParamsChange: (patch: Partial<CarbonParams>) => void;
  selectedModel: CarbonModelListItem | null;
  onModelSelect: (model: CarbonModelListItem | null) => void;
  directLoadEnabled: boolean;
  onDirectLoadChange: (enabled: boolean) => void;
}

function groupByAlgorithm(models: CarbonModelListItem[]) {
  const grouped: Record<string, CarbonModelListItem[]> = {};
  for (const m of models) {
    const algo = m.algorithm || "Other";
    (grouped[algo] ??= []).push(m);
  }
  return grouped;
}

function modelBadge(model: CarbonModelListItem, t: (key: string) => string): string {
  const meta = model.metadata_json;
  if (meta?.provider === "ibm_granite_hls") return ` [${t("carbon.params.compat.graniteHls")}]`;
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

function pickDefaultModel(models: CarbonModelListItem[], referenceDataset: string): CarbonModelListItem | null {
  if (!models.length) return null;
  if (models.every((model) => model.metadata_json?.provider === "ibm_granite_hls")) return null;
  if (referenceDataset === "ORNL_BGB") {
    return models.find((model) => model.metadata_json?.training_mode === "reference_raster") ?? models[0];
  }
  if (referenceDataset === DEFAULT_CARBON_REFERENCE_DATASET) {
    const gediL4aModel = models.find((model) => /gedi[._-]?l4a/i.test(model.name));
    if (gediL4aModel) return gediL4aModel;
  }
  return models[0];
}

type CarbonDatasetGroupKey = "agb" | "bgb" | "mixed_biomass" | "soc" | "litter" | "ecosystem" | "other";

const CARBON_DATASET_GROUPS: Record<CarbonDatasetGroupKey, { label: string; order: number }> = {
  agb: { label: "carbon.datasetGroup.agb", order: 0 },
  bgb: { label: "carbon.datasetGroup.bgb", order: 1 },
  mixed_biomass: { label: "carbon.datasetGroup.mixedBiomass", order: 2 },
  soc: { label: "carbon.datasetGroup.soc", order: 3 },
  litter: { label: "carbon.datasetGroup.litter", order: 4 },
  ecosystem: { label: "carbon.datasetGroup.ecosystem", order: 5 },
  other: { label: "carbon.datasetGroup.other", order: 6 },
};

function carbonDatasetGroup(dataset: CarbonReferenceDatasetOption): CarbonDatasetGroupKey {
  const pool = `${dataset.targetPool ?? ""} ${dataset.group ?? ""}`.toLowerCase();
  if (/litter|detritus|serasah/.test(pool)) return "litter";
  if (/soil_organic_carbon|soil organic carbon|soil carbon|\bsoc\b/.test(pool)) return "soc";
  if (/total_ecosystem_carbon|total ecosystem carbon/.test(pool)) return "ecosystem";
  if (/aboveground_belowground|above and belowground|combined_biomass|combined biomass/.test(pool)) {
    return "mixed_biomass";
  }
  if (/belowground_biomass|belowground biomass|root_biomass|root biomass|\bbgb\b/.test(pool)) return "bgb";
  if (/aboveground_biomass|aboveground biomass|forest_woody_biomass|woody biomass|\bagb\b/.test(pool)) {
    return "agb";
  }
  return "other";
}

type CompatibilityTone = "green" | "gray" | "orange";

function compatibilityInfo(
  t: (key: string) => string,
  meta?: CarbonModelMeta,
  algorithm?: string,
): { text: string; tone: CompatibilityTone } {
  if (!meta) return { text: "N/A", tone: "gray" };
  if (meta.provider === "ibm_granite_hls") {
    return { text: t("carbon.params.compat.graniteHls"), tone: "gray" };
  }
  if (meta.provider === "non_gee_stac" || meta.provider === "local_raster") {
    return { text: t("carbon.params.compat.nonGeeStac"), tone: "gray" };
  }
  if (!meta.gee_deployable) return { text: t("carbon.params.compat.statsOnly"), tone: "gray" };
  if (meta.builtin) return { text: t("carbon.pool.builtinModel"), tone: "green" };
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
  directLoadEnabled,
  onDirectLoadChange,
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
      })
      .catch(() => {
        if (cancelled) return;
        setDatasets(availableCarbonReferenceDatasets(FALLBACK_CARBON_REFERENCE_DATASETS).map((d) => ({ ...d, source: "fallback" })));
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

  useEffect(() => {
    if (!datasets.length) return;
    const referenceDataset = resolveCarbonReferenceDataset(params.referenceDataset, datasets);
    if (referenceDataset !== params.referenceDataset) {
      onParamsChange({ referenceDataset, modelName: null });
    }
  }, [datasets, params.referenceDataset, onParamsChange]);

  // Per-dataset year options: prefer the selected dataset's own `year`/
  // `yearRange` from the live catalog (e.g. WCMC is 2010-only, GEDI is
  // 2019-2023) over the flat CARBON_DATASET_YEARS fallback, which offered
  // the same year list regardless of which dataset was picked.
  const selectedDatasetMeta = datasets.find((d) => d.value === params.referenceDataset);
  const frozenReferenceYear = !params.referenceOnly && !directLoadEnabled
    && selectedModel?.metadata_json?.method === "saved_reference_ensemble"
    && typeof selectedModel.metadata_json.reference_year === "number"
    ? selectedModel.metadata_json.reference_year : null;
  const yearOptions = frozenReferenceYear === null
    ? carbonDatasetYearOptions(selectedDatasetMeta) : [frozenReferenceYear];

  useEffect(() => {
    if (!yearOptions.length) return;
    if (!yearOptions.includes(params.datasetYear)) {
      onParamsChange({ datasetYear: yearOptions[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.referenceDataset, datasets, frozenReferenceYear, params.datasetYear]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    listCarbonModels(params.referenceDataset)
      .then((list) => {
        if (cancelled) return;
        const orderedModels = [...list].sort(compareModels);
        setModels(orderedModels);
        const first = pickDefaultModel(orderedModels, params.referenceDataset);
        if (first) {
          onModelSelect(first);
          // Changing the dataset must not silently turn off direct
          // reference-only mode; the selected model is merely kept ready if
          // the user switches back to model inference.
          onParamsChange({ modelName: first.name, referenceOnly: params.referenceOnly, loadOnly: params.loadOnly });
        } else {
          onModelSelect(null);
          const meta = datasets.find((d) => d.value === params.referenceDataset);
          onParamsChange({
            modelName: null,
            referenceOnly: Boolean(meta?.referenceOnlyCapable || (meta?.source === "fallback" && !meta.requiresConfiguration)),
            loadOnly: params.loadOnly,
          });
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
  }, [params.referenceDataset, datasets]);

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
  const datasetOptions = useMemo(() => datasets
    .map((dataset, index) => {
      const groupKey = carbonDatasetGroup(dataset);
      const group = CARBON_DATASET_GROUPS[groupKey];
      const description = dataset.requiresConfiguration && dataset.isConfigured === false
        ? "Perlu konfigurasi"
        : dataset.compatibleModelCount !== undefined
          ? `${dataset.compatibleModelCount} model ${t("status.compatible")}`
          : undefined;
      return {
        index,
        groupOrder: group.order,
        option: {
          value: dataset.value,
          label: dataset.deprecated ? `${dataset.label} · legacy` : dataset.label,
          group: t(group.label),
          description,
        },
      };
    })
    .sort((a, b) => a.groupOrder - b.groupOrder || a.index - b.index)
    .map(({ option }) => option), [datasets, t]);
  const isGraniteHlsModel = selectedModel?.metadata_json?.provider === "ibm_granite_hls";
  const canReferenceOnly = Boolean(datasetMeta?.referenceOnlyCapable || (datasetMeta?.source === "fallback" && !datasetMeta.requiresConfiguration));
  const analysisMode = directLoadEnabled ? "global" : params.referenceOnly ? "reference_aoi" : "model";
  const grouped = groupByAlgorithm(models);
  const geeCount = models.filter((m) => m.metadata_json?.gee_deployable).length;

  const cv = modelInfo?.cv_metrics || modelInfo?.metrics?.cv_metrics;

  return (
    <div id="carbonParams">
      <div className="carbon-info-heading">
        <h6>
          <i className="bi bi-tree me-1" /> {t("carbon.params.title")}
        </h6>
        <InfoTip align="end" label={t("carbon.params.moreInfo")} content={t("carbon.params.intro")} />
      </div>

      <div className="mb-3">
        <div className="carbon-info-label">
          <label className="form-label" htmlFor="carbonAnalysisMode">{t("carbon.params.analysisMode")}</label>
          <InfoTip
            label={t("carbon.params.moreInfo")}
            content={t(analysisMode === "global"
              ? "carbon.params.globalModeHint"
              : analysisMode === "reference_aoi"
                ? "carbon.params.referenceOnlyHint"
                : "carbon.params.modelModeHint")}
          />
        </div>
        <select
          id="carbonAnalysisMode"
          className="form-select"
          value={analysisMode}
          onChange={(event) => {
            const mode = event.target.value;
            if (mode === "global") {
              onParamsChange({ referenceOnly: false, loadOnly: false });
              onDirectLoadChange(true);
            } else if (mode === "reference_aoi") {
              onDirectLoadChange(false);
              onParamsChange({ referenceOnly: true, loadOnly: false, modelName: null });
              onModelSelect(null);
            } else {
              onDirectLoadChange(false);
              onParamsChange({ referenceOnly: false, loadOnly: false });
            }
          }}
        >
          <option value="model" disabled={models.length === 0 && !modelsLoading}>{t("carbon.params.modelMode")}</option>
          {canReferenceOnly && <option value="reference_aoi">{t("carbon.params.referenceOnlyMode")}</option>}
          <option value="global">{t("carbon.params.globalMode")}</option>
        </select>
      </div>
      {analysisMode === "reference_aoi" && (
        <>
          <div className="carbon-help-toggle-row mb-3">
            <label className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={params.loadOnly}
                onChange={(event) => onParamsChange({ loadOnly: event.target.checked })}
              />
              <span className="form-check-label small">{t("carbon.params.loadOnlyLabel")}</span>
            </label>
            <InfoTip label={t("carbon.params.moreInfo")} content={t("carbon.params.loadOnlyHint")} />
          </div>
        </>
      )}

      <div className="mb-3">
        <div className="carbon-info-label">
          <label className="form-label">
            <i className="bi bi-database me-1" /> {t("carbon.params.referenceDataset")}
          </label>
          {datasetMeta && <InfoTip label={t("carbon.params.moreInfo")} content={datasetMeta.description} />}
        </div>
        <SearchableSelect
          value={params.referenceDataset}
          onChange={(v) => {
            const nextDataset = datasets.find((dataset) => dataset.value === v);
            const nextSupportsReferenceOnly = Boolean(
              nextDataset?.referenceOnlyCapable ||
              (nextDataset?.source === "fallback" && !nextDataset.requiresConfiguration),
            );
            onParamsChange({
              referenceDataset: v,
              ...(params.referenceOnly && !nextSupportsReferenceOnly
                ? { referenceOnly: false, loadOnly: false }
                : {}),
            });
          }}
          options={datasetOptions}
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
        {datasetMeta?.depthCm && (
          <small className="text-muted d-block mt-1">
            {t("carbon.pool.depth")}: {datasetMeta.depthCm.join("–")} cm · {datasetMeta.unit}
          </small>
        )}
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
      </div>

      <div className="mb-3" style={analysisMode !== "model" ? { display: "none" } : undefined}>
        <div className="carbon-info-label">
          <label className="form-label">
            <i className="bi bi-cpu me-1" /> {t("carbon.params.trainedModel")}
          </label>
          <InfoTip label={t("carbon.params.moreInfo")} content={t("carbon.params.modelIntro")} />
        </div>
        <SearchableSelect
          value={params.modelName ?? ""}
          onChange={(v) => {
            const name = v || null;
            onParamsChange({ modelName: name, referenceOnly: false, loadOnly: false });
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
                label: `${m.display_name || m.name}${modelBadge(m, t)}`,
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
            onParamsChange({ modelName: name, referenceOnly: false, loadOnly: false });
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

      {(analysisMode !== "model" || !isGraniteHlsModel) && <div className="mb-3">
        <div className="carbon-info-label">
          <label className="form-label">{params.referenceOnly ? t("carbon.referenceYearLabel") : t("carbon.params.datasetYear")}</label>
          {params.referenceOnly && (
            <InfoTip
              label={t("carbon.params.moreInfo")}
              content={params.loadOnly
                ? t("carbon.params.loadOnlyHint")
                : t("carbon.params.referenceOnlySummary", {
                    name: datasetMeta?.label || params.referenceDataset,
                    year: params.datasetYear,
                  })}
            />
          )}
        </div>
        <select
          className="form-select"
          id="carbonDatasetYear"
          value={params.datasetYear}
          onChange={(e) => onParamsChange({ datasetYear: Number(e.target.value) })}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {datasetMeta?.periods?.[String(y)]?.join("–") || y}
            </option>
          ))}
        </select>
      </div>}

      {analysisMode === "model" && !selectedModel?.metadata_json?.builtin && (
        <>
          <div className="mb-3">
            <label className="form-label">{t(isGraniteHlsModel ? "carbon.params.dateRangeHls" : "carbon.params.dateRange")}</label>
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

          {!isGraniteHlsModel && (
            <>
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
                <div className="carbon-info-label">
                  <label className="form-label">{t("carbon.params.cloudTechnique")}</label>
                  {techniques[params.cloudMaskTechnique] && (
                    <InfoTip label={t("carbon.params.moreInfo")} content={techniques[params.cloudMaskTechnique].description} />
                  )}
                </div>
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
              </div>
            </>
          )}
        </>
      )}

      {analysisMode !== "global" && !isGraniteHlsModel && <div className="mb-3">
        <div className="carbon-info-label">
          <label className="form-label">
            <i className="bi bi-scissors me-1" /> {t("carbon.params.displayMode")}
          </label>
          <InfoTip
            label={t("carbon.params.moreInfo")}
            content={params.clipMode === "clipped" ? t("carbon.params.clippedDesc") : t("carbon.params.fullTilesDesc")}
          />
        </div>
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
      </div>}

      {analysisMode === "model" && selectedModel && !isGraniteHlsModel && <div className="carbon-help-toggle-row form-check mb-2">
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
        <InfoTip
          label={t("carbon.params.moreInfo")}
          content={t(params.referenceOnly ? "carbon.params.referenceOnlyMapHint" : "carbon.params.showReferenceHint")}
        />
      </div>}
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
