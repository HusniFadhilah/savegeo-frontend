import { useEffect, useState } from "react";
import { createAnalysisRun, listDisasterModels, runAnalysis } from "../../api";
import type { AnalysisRunWithResult, DisasterAoi, DisasterModelRegistryEntry, SatelliteImagery } from "../../types";
import { useAdmin } from "../../AdminContext";

const RUN_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  review_required: "Review Required",
  published: "Published",
};
const RUN_STATUS_BADGE: Record<string, string> = {
  queued: "badge-gray",
  processing: "badge-blue",
  completed: "badge-green",
  failed: "badge-red",
  review_required: "badge-amber",
  published: "badge-purple",
};

interface Props {
  eventId: number;
  aoi: DisasterAoi | null;
  imagery: { pre: SatelliteImagery[]; post: SatelliteImagery[] };
  runs: AnalysisRunWithResult[];
  onChanged: () => void;
}

function imageryLabel(img: SatelliteImagery): string {
  return `${img.satellite} — ${img.acquisition_date}${img.is_primary ? " (Utama)" : ""}`;
}

/**
 * Model picker sourced from `GET /admin/disasters/models` (registry, not the
 * event-scoped run list) - disabled entries render grayed out with the
 * registry's `description` explaining why, matching the User-side MVP rule
 * that disabled models never show a runnable control anywhere.
 */
export default function AnalysisManager({ eventId, aoi, imagery, runs, onChanged }: Props) {
  const { notify } = useAdmin();
  const [models, setModels] = useState<DisasterModelRegistryEntry[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [openConfigModelId, setOpenConfigModelId] = useState<string | null>(null);
  const [preImageryId, setPreImageryId] = useState("");
  const [postImageryId, setPostImageryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busyRunId, setBusyRunId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listDisasterModels()
      .then((res) => {
        if (!cancelled) setModels(res.models);
      })
      .catch((err) => {
        if (!cancelled) setModelsError(err instanceof Error ? err.message : "Gagal memuat daftar model");
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runsByModel = new Map<string, AnalysisRunWithResult[]>();
  for (const r of runs) {
    const list = runsByModel.get(r.run.model_id) ?? [];
    list.push(r);
    runsByModel.set(r.run.model_id, list);
  }

  const openConfig = (modelId: string) => {
    setOpenConfigModelId(modelId);
    setPreImageryId("");
    setPostImageryId("");
    setConfigError(null);
  };

  const handleCreateRun = async (model: DisasterModelRegistryEntry) => {
    if (!aoi) {
      setConfigError("AOI belum dikonfigurasi untuk kejadian ini");
      return;
    }
    const needsPre = model.input_type.includes("pre_imagery");
    const needsPost = model.input_type.includes("post_imagery");
    if (needsPre && !preImageryId) {
      setConfigError("Pilih citra pra-bencana");
      return;
    }
    if (needsPost && !postImageryId) {
      setConfigError("Pilih citra pasca-bencana");
      return;
    }
    setCreating(true);
    setConfigError(null);
    try {
      await createAnalysisRun(eventId, {
        model_id: model.model_id,
        aoi_id: aoi.id,
        pre_imagery_id: preImageryId ? Number(preImageryId) : undefined,
        post_imagery_id: postImageryId ? Number(postImageryId) : undefined,
      });
      notify("Analisis dikonfigurasi", "s");
      setOpenConfigModelId(null);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengkonfigurasi analisis";
      setConfigError(msg);
      notify(msg, "e");
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (runId: number) => {
    setBusyRunId(runId);
    try {
      await runAnalysis(runId);
      notify("Analisis selesai dijalankan", "s");
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menjalankan analisis", "e");
    } finally {
      setBusyRunId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Analysis Manager</span>
      </div>
      <div className="card-body-custom">
        {!aoi && (
          <div className="alert alert-danger py-1 px-2 small" style={{ marginBottom: "0.75rem" }}>
            AOI belum dikonfigurasi - buka tab AOI terlebih dahulu sebelum menjalankan analisis.
          </div>
        )}
        {loadingModels && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Memuat daftar model...</div>}
        {modelsError && <div className="alert alert-danger py-1 px-2 small">{modelsError}</div>}

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
                          {model.user_label}{" "}
                          <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({model.backend_label})</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{model.description}</div>
                        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <span className="badge-label">{model.category}</span>
                          {!model.enabled && <span className="stat-badge badge-gray">Not Available</span>}
                        </div>
                      </div>
                      {model.enabled && (
                        <button type="button" className="btn-sm" disabled={!aoi} onClick={() => openConfig(model.model_id)}>
                          <i className="bi bi-plus-lg" /> Konfigurasi Analisis Baru
                        </button>
                      )}
                    </div>

                    {isConfiguring && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <div className="two-col" style={{ marginBottom: "0.5rem" }}>
                          {model.input_type.includes("pre_imagery") && (
                            <div className="form-field">
                              <label className="form-label">Citra Pra-bencana *</label>
                              <select className="form-input" value={preImageryId} onChange={(e) => setPreImageryId(e.target.value)}>
                                <option value="">— pilih —</option>
                                {imagery.pre.map((img) => (
                                  <option key={img.id} value={img.id}>
                                    {imageryLabel(img)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {model.input_type.includes("post_imagery") && (
                            <div className="form-field">
                              <label className="form-label">Citra Pasca-bencana *</label>
                              <select className="form-input" value={postImageryId} onChange={(e) => setPostImageryId(e.target.value)}>
                                <option value="">— pilih —</option>
                                {imagery.post.map((img) => (
                                  <option key={img.id} value={img.id}>
                                    {imageryLabel(img)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        {configError && <div className="alert alert-danger py-1 px-2 small">{configError}</div>}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn-sm primary" disabled={creating} onClick={() => handleCreateRun(model)}>
                            {creating ? "Menyimpan..." : "Simpan Konfigurasi"}
                          </button>
                          <button type="button" className="btn-sm" onClick={() => setOpenConfigModelId(null)}>
                            Batal
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
                                {RUN_STATUS_LABEL[run.status] || run.status}
                              </span>
                              <span style={{ color: "var(--text-muted)" }}>
                                Run #{run.id} • dibuat {run.created_at ? new Date(run.created_at).toLocaleString("id-ID") : "—"}
                              </span>
                              {result?.is_published && <span className="stat-badge badge-purple">Published</span>}
                              {run.error_message && <span style={{ color: "#b91c1c" }}>{run.error_message}</span>}
                            </div>
                            <button
                              type="button"
                              className="btn-sm"
                              style={{ padding: "2px 6px", fontSize: 10 }}
                              disabled={busyRunId === run.id || run.status === "processing"}
                              onClick={() => handleRun(run.id)}
                            >
                              {busyRunId === run.id ? "Menjalankan..." : run.status === "failed" ? "Coba Lagi" : "Run"}
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
