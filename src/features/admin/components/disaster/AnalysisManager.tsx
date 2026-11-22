import { useEffect, useState } from "react";
import { createAnalysisRun, listDisasterModels, runAnalysis } from "../../api";
import type { AnalysisRunWithResult, DisasterAoi, DisasterModelRegistryEntry, SatelliteImagery } from "../../types";
import { useAdmin } from "../../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";

const RUN_STATUS_KEYS: Record<string, string> = {
  queued: "admin.disaster.queuedStatus",
  processing: "admin.disaster.processingStatus",
  completed: "admin.disaster.completedStatus",
  failed: "admin.disaster.failedStatus",
  review_required: "admin.disaster.reviewRequiredStatus",
  published: "admin.disaster.published",
  stale: "admin.disaster.staleStatus",
};
const RUN_STATUS_BADGE: Record<string, string> = {
  queued: "badge-gray",
  processing: "badge-blue",
  completed: "badge-green",
  failed: "badge-red",
  review_required: "badge-amber",
  published: "badge-purple",
  stale: "badge-red",
};

interface Props {
  eventId: number;
  aoi: DisasterAoi | null;
  imagery: { pre: SatelliteImagery[]; post: SatelliteImagery[] };
  runs: AnalysisRunWithResult[];
  onChanged: () => void;
}

function imageryLabel(img: SatelliteImagery, t: (key: string) => string): string {
  return `${img.satellite} — ${img.acquisition_date}${img.is_primary ? ` (${t("admin.disaster.primary")})` : ""}`;
}

/**
 * Model picker sourced from `GET /admin/disasters/models` (registry, not the
 * event-scoped run list) - disabled entries render grayed out with the
 * registry's `description` explaining why, matching the User-side MVP rule
 * that disabled models never show a runnable control anywhere.
 */
export default function AnalysisManager({ eventId, aoi, imagery, runs, onChanged }: Props) {
  const t = useI18nStore((state) => state.t);
  const { notify } = useAdmin();
  const [models, setModels] = useState<DisasterModelRegistryEntry[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [openConfigModelId, setOpenConfigModelId] = useState<string | null>(null);
  const [preImageryId, setPreImageryId] = useState("");
  const [postImageryId, setPostImageryId] = useState("");
  const [parametersText, setParametersText] = useState("");
  const [creating, setCreating] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busyRunId, setBusyRunId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listDisasterModels(eventId)
      .then((res) => {
        if (!cancelled) setModels(res.models);
      })
      .catch((err) => {
        if (!cancelled) setModelsError(err instanceof Error ? err.message : t("admin.disaster.loadModelsFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, t]);

  const runsByModel = new Map<string, AnalysisRunWithResult[]>();
  for (const r of runs) {
    const list = runsByModel.get(r.run.model_id) ?? [];
    list.push(r);
    runsByModel.set(r.run.model_id, list);
  }

  const openConfig = (modelId: string) => {
    setOpenConfigModelId(modelId);
    const model = models.find(m => m.model_id === modelId);
    setPreImageryId(model?.default_pre_imagery_id ? String(model.default_pre_imagery_id) : "");
    setPostImageryId(model?.default_post_imagery_id ? String(model.default_post_imagery_id) : "");
    setParametersText("");
    setConfigError(null);
  };

  const handleCreateRun = async (model: DisasterModelRegistryEntry) => {
    if (!aoi) {
      setConfigError(t("admin.disaster.aoiNotConfigured"));
      return;
    }
    const needsPre = model.input_type.includes("pre_imagery");
    const needsPost = model.input_type.includes("post_imagery");
    if (needsPre && !preImageryId) {
      setConfigError(t("admin.disaster.choosePreImagery"));
      return;
    }
    if (needsPost && !postImageryId) {
      setConfigError(t("admin.disaster.choosePostImagery"));
      return;
    }
    setCreating(true);
    setConfigError(null);
    try {
      let parameters: Record<string, unknown> | undefined;
      if (parametersText.trim()) {
        try {
          const parsed = JSON.parse(parametersText);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("admin.disaster.jsonObject"));
          parameters = parsed as Record<string, unknown>;
        } catch (error) {
          setConfigError(t("admin.disaster.invalidJson", { error: error instanceof Error ? error.message : t("admin.disaster.jsonFormat") }));
          setCreating(false);
          return;
        }
      }
      if (["building_exposure", "road_exposure", "building_change"].includes(model.category) && !parameters) {
        setConfigError(t("admin.disaster.exposureParamsRequired"));
        setCreating(false);
        return;
      }
      await createAnalysisRun(eventId, {
        model_id: model.model_id,
        aoi_id: aoi.id,
        pre_imagery_id: preImageryId ? Number(preImageryId) : undefined,
        post_imagery_id: postImageryId ? Number(postImageryId) : undefined,
        parameters,
      });
      notify(t("admin.disaster.analysisConfigured"), "s");
      setOpenConfigModelId(null);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.disaster.configureFailed");
      setConfigError(msg);
      notify(msg, "e");
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (runId: number) => {
    setBusyRunId(runId);
    try {
      const outcome = await runAnalysis(runId);
      notify(outcome.run.status === "review_required" ? t("admin.disaster.analysisCompleteReview") : t("admin.disaster.analysisComplete"), "s");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.disaster.runFailed"), "e");
    } finally {
      setBusyRunId(null);
      onChanged();
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.disaster.analysisManagement")}</span>
      </div>
      <div className="card-body-custom">
        {!aoi && (
          <div className="alert alert-danger py-1 px-2 small" style={{ marginBottom: "0.75rem" }}>
            {t("admin.disaster.aoiRequired")}
          </div>
        )}
        {loadingModels && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("admin.disaster.modelLoadProgress")}</div>}
        {modelsError && <div className="alert alert-danger py-1 px-2 small">{modelsError}</div>}
        {busyRunId !== null && <div className="alert alert-info" role="status"><span className="spinner-border spinner-border-sm me-2" />{t("admin.disaster.processingAnalysis")}{busyRunId}{t("admin.disaster.processingAnalysisEnd")}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!loadingModels &&
            !modelsError &&
            models.map((model) => {
              const modelRuns = runsByModel.get(model.model_id) ?? [];
              const isConfiguring = openConfigModelId === model.model_id;
              return (
                <div
                  key={model.model_id}
                  className="card"
                  style={{
                    margin: 0,
                    opacity: model.enabled ? 1 : 0.55,
                    background: model.enabled ? undefined : "#f8fafc",
                  }}
                >
                  <div className="card-body-custom" style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {model.user_label}{model.recommended && ` · ${t("admin.disaster.recommended")}`}{" "}
                          <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({model.backend_label})</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{model.description} {model.reliability} {model.availability_reason}</div>
                        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <span className="badge-label">{model.category}</span>
                          {model.capability_status && <span className={`stat-badge ${model.capability_status === "indicator_only" ? "badge-amber" : "badge-gray"}`}>{model.capability_status}</span>}
                          {model.damage_model === false && <span className="stat-badge badge-amber">{t("admin.disaster.indicatorNotDamage")}</span>}
                          {!model.enabled && <span className="stat-badge badge-gray">{t("admin.disaster.notAvailable")}</span>}
                        </div>
                      </div>
                      {model.enabled && (
                        <button type="button" className="btn-sm" disabled={!aoi || model.configured === false || model.inputs_ready === false} onClick={() => openConfig(model.model_id)}>
                          <i className="bi bi-plus-lg" /> {t("admin.disaster.newAnalysisConfig")}
                        </button>
                      )}
                    </div>

                    {isConfiguring && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <div className="two-col" style={{ marginBottom: "0.5rem" }}>
                          {model.input_type.includes("pre_imagery") && (
                            <div className="form-field">
                              <label className="form-label">{t("admin.disaster.preEventImagery")}</label>
                              <select className="form-input" value={preImageryId} onChange={(e) => setPreImageryId(e.target.value)}>
                                <option value="">{t("admin.disaster.choose")}</option>
                                {imagery.pre.map((img) => (
                                  <option key={img.id} value={img.id}>
                                    {imageryLabel(img, t)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {model.input_type.includes("post_imagery") && (
                            <div className="form-field">
                              <label className="form-label">{t("admin.disaster.postEventImagery")}</label>
                              <select className="form-input" value={postImageryId} onChange={(e) => setPostImageryId(e.target.value)}>
                                <option value="">{t("admin.disaster.choose")}</option>
                                {imagery.post.map((img) => (
                                  <option key={img.id} value={img.id}>
                                    {imageryLabel(img, t)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        {["building_exposure", "road_exposure", "landcover_impact", "building_change"].includes(model.category) && (
                          <div className="form-field" style={{ marginBottom: "0.5rem" }}>
                            <label className="form-label">{t("admin.disaster.hazardParams")}</label>
                            <textarea className="form-input" rows={4} value={parametersText} onChange={(e) => setParametersText(e.target.value)} placeholder={'{"source_dataset":"...","source_date":"YYYY-MM-DD","source_kind":"official","hazard_geojson":{...},"exposure_features":{...}}'} />
                            <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{t("admin.disaster.noFallback")}</div>
                          </div>
                        )}
                        {configError && <div className="alert alert-danger py-1 px-2 small">{configError}</div>}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn-sm primary" disabled={creating} onClick={() => handleCreateRun(model)}>
                            {creating ? t("admin.disaster.saving") : t("admin.disaster.saveConfiguration")}
                          </button>
                          <button type="button" className="btn-sm" onClick={() => setOpenConfigModelId(null)}>
                            {t("admin.disaster.cancel")}
                          </button>
                        </div>
                      </div>
                    )}

                    {modelRuns.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                        {modelRuns.map(({ run, result }) => (
                          <div
                            key={run.id}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={`stat-badge ${RUN_STATUS_BADGE[run.status] || "badge-gray"}`}>
                                {RUN_STATUS_KEYS[run.status] ? t(RUN_STATUS_KEYS[run.status]) : run.status}
                              </span>
                              <span style={{ color: "var(--text-muted)" }}>
                                {t("admin.disaster.process")}{run.id} • {t("admin.disaster.created")} {run.created_at ? new Date(run.created_at).toLocaleString("id-ID") : "—"}
                              </span>
                              {result?.is_published && <span className="stat-badge badge-purple">{t("admin.disaster.published")}</span>}
                              {result?.validation_status === "indicator_only" && <span className="stat-badge badge-amber">{t("admin.disaster.indicatorOnly")}</span>}
                              {run.error_message && <span style={{ color: "#b91c1c" }}>{run.error_message}</span>}
                            </div>
                            <button
                              type="button"
                              className="btn-sm"
                              style={{ padding: "2px 6px", fontSize: 10 }}
                              disabled={busyRunId === run.id || run.status === "processing"}
                              onClick={() => handleRun(run.id)}
                            >
                              {busyRunId === run.id ? t("admin.disaster.operationLoading") : run.status === "failed" ? t("admin.disaster.runAgainButton") : t("admin.disaster.runButton")}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
