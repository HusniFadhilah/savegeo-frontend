import { useEffect, useState } from "react";
import { listCarbonModels, getCarbonModelInfo } from "@/features/carbon/api";
import { CARBON_REFERENCE_DATASETS, CARBON_DATASET_YEARS } from "@/features/carbon/referenceDatasets";
import type {
  CarbonModelInfo,
  CarbonModelListItem,
  CarbonModelMeta,
  CarbonParams,
  ClipMode,
} from "@/features/carbon/types";
import SearchableSelect from "@/components/ui/SearchableSelect";

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
    model.metadata_json?.cv_metrics?.r2_mean
  );
}

function modelDate(model: CarbonModelListItem): string | undefined {
  return model.uploaded_at ?? model.metadata_json?.trained_at;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID");
}

function formatDateTime(iso?: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("id-ID");
}

type CompatibilityTone = "green" | "gray" | "orange";

function compatibilityInfo(
  meta?: CarbonModelMeta,
  algorithm?: string,
): { text: string; tone: CompatibilityTone } {
  if (!meta) return { text: "N/A", tone: "gray" };
  if (meta.provider === "non_gee_stac" || meta.provider === "local_raster") {
    return { text: "Non-GEE (STAC)", tone: "gray" };
  }
  if (!meta.gee_deployable) return { text: "Statistik Saja", tone: "gray" };
  if (meta.gee_algorithm_type === "native_classifier") return { text: "GEE Native", tone: "green" };
  if (meta.gee_algorithm_type === "linear_expression") return { text: "GEE Direct", tone: "green" };
  // Older models predate `gee_algorithm_type` — infer linear-direct from algorithm name.
  const algo = (algorithm || meta.algorithm || "").toLowerCase();
  if (/^(ridge|lasso|linear|elastic_net)/.test(algo)) return { text: "GEE Direct", tone: "green" };
  return { text: "Requires Surrogate", tone: "orange" };
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
  const [models, setModels] = useState<CarbonModelListItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<CarbonModelInfo | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    listCarbonModels(params.referenceDataset)
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        const firstGee = list.find((m) => m.metadata_json?.gee_deployable && !m.metadata_json?.preliminary);
        const first = firstGee || list.find((m) => !m.metadata_json?.preliminary) || list[0] || null;
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

  const datasetMeta = CARBON_REFERENCE_DATASETS.find((d) => d.value === params.referenceDataset);
  const grouped = groupByAlgorithm(models);
  const geeCount = models.filter((m) => m.metadata_json?.gee_deployable).length;

  const cv = modelInfo?.cv_metrics || modelInfo?.metrics?.cv_metrics;

  return (
    <div id="carbonParams">
      <h6 className="mb-3">
        <i className="bi bi-tree me-1" /> Parameter Analisis Karbon
      </h6>
      <div className="alert alert-info py-2">
        <small>
          <i className="bi bi-info-circle me-1" />
          Estimasi stok karbon di atas permukaan menggunakan citra Sentinel-2 dan dataset biomassa
          referensi dengan regresi machine learning.
        </small>
      </div>

      <div className="mb-3">
        <label className="form-label">
          <i className="bi bi-database me-1" /> Dataset Referensi
        </label>
        <SearchableSelect
          value={params.referenceDataset}
          onChange={(v) => onParamsChange({ referenceDataset: v })}
          options={CARBON_REFERENCE_DATASETS.map((d) => ({
            value: d.value,
            label: d.label,
            description: d.group,
          }))}
          placeholder="-- Pilih Dataset Referensi --"
        />
        {datasetMeta && (
          <small className="text-muted d-block mt-1">
            <i className="bi bi-info-circle me-1" />
            {datasetMeta.description}
          </small>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">
          <i className="bi bi-cpu me-1" /> Model Terlatih
        </label>
        <div className="alert alert-info py-2 mb-2">
          <small>
            <i className="bi bi-info-circle me-1" />
            Hanya model Linear/Ridge/Lasso yang bisa di-deploy langsung ke Google Earth Engine
            untuk peta tile. Model Random Forest dan sejenisnya hanya statistik.
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
              const date = formatDate(modelDate(m));
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
          placeholder="-- Pilih Model --"
          loading={modelsLoading}
          disabled={modelsLoading}
        />
        <small className="text-muted d-block mt-1">
          {models.length > 0 ? (
            <>
              <i className="bi bi-check-circle text-success me-1" />
              {models.length} model untuk {params.referenceDataset}
              {geeCount > 0 ? ` (${geeCount} siap peta-tile GEE)` : " - tidak ada model peta-tile"}
            </>
          ) : !modelsLoading ? (
            <>
              <i className="bi bi-exclamation-triangle text-warning me-1" />
              Tidak ada model terlatih untuk dataset ini.
            </>
          ) : null}
        </small>

        {selectedModel && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary mt-2"
            onClick={() => setShowModelInfo((s) => !s)}
          >
            <i className="bi bi-info-circle me-1" /> {showModelInfo ? "Sembunyikan" : "Lihat"} Detail Model
          </button>
        )}
        {showModelInfo && modelInfo && (
          <div className="cm-detail-card mt-2">
            <div className="cm-detail-title">
              <i className="bi bi-info-circle" /> Detail Model
            </div>
            <div className="cm-detail-grid">
              <div className="cm-detail-label">Name</div>
              <div className="cm-detail-value cm-detail-mono">
                {modelInfo.name || params.modelName || "N/A"}
              </div>

              <div className="cm-detail-label">Algorithm</div>
              <div className="cm-detail-value">
                {modelInfo.algorithm || modelInfo.metadata_json?.algorithm || "N/A"}
              </div>

              <div className="cm-detail-label">Trained</div>
              <div className="cm-detail-value">
                {formatDateTime(
                  modelInfo.trained_at ?? modelInfo.metadata_json?.trained_at ?? modelInfo.metrics?.trained_at,
                )}
              </div>

              <div className="cm-detail-label">Samples</div>
              <div className="cm-detail-value">
                {modelInfo.n_samples ?? modelInfo.metrics?.n_samples ?? "N/A"}
              </div>

              <div className="cm-detail-label">Version</div>
              <div className="cm-detail-value">{modelInfo.version || "N/A"}</div>

              <div className="cm-detail-label">Compatibility</div>
              <div className="cm-detail-value">
                {(() => {
                  const c = compatibilityInfo(
                    modelInfo.metadata_json,
                    modelInfo.algorithm ?? modelInfo.metadata_json?.algorithm,
                  );
                  return <span className={`cm-badge cm-badge-${c.tone}`}>{c.text}</span>;
                })()}
              </div>

              {cv && (
                <>
                  <div className="cm-detail-label">CV Folds</div>
                  <div className="cm-detail-value">{cv.n_folds ?? cv.cv_folds ?? "N/A"}</div>

                  <div className="cm-detail-label">Mean RMSE</div>
                  <div className="cm-detail-value">{cv.rmse_mean?.toFixed?.(2) ?? "N/A"}</div>

                  <div className="cm-detail-label">Mean R²</div>
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
                  <div className="cm-detail-label mb-1">Top 5 Features</div>
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
        <label className="form-label">Tahun Dataset Referensi</label>
        <select
          className="form-select"
          value={params.datasetYear}
          onChange={(e) => onParamsChange({ datasetYear: Number(e.target.value) })}
        >
          {CARBON_DATASET_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">Rentang Tanggal Sentinel-2</label>
        <div className="d-flex gap-2 align-items-center">
          <select
            className="form-select"
            value={params.startMonth}
            onChange={(e) => onParamsChange({ startMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-muted">s/d</span>
          <select
            className="form-select"
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

      <div className="mb-3">
        <label className="form-label">Ambang Awan (%)</label>
        <input
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
        <label className="form-label">
          <i className="bi bi-scissors me-1" /> Mode Tampilan
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
              {mode === "clipped" ? "Clipped" : "Full Tiles"}
            </button>
          ))}
        </div>
        <small className="text-muted d-block mt-1">
          <i className="bi bi-info-circle me-1" />
          {params.clipMode === "clipped"
            ? "Clipped: dipotong presisi sesuai batas AOI (lebih lambat)."
            : "Full Tiles: seluruh tile tanpa dipotong (lebih cepat)."}
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
          Tampilkan Dataset Referensi di Peta
        </label>
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
