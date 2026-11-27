import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { workflowApi, type WorkflowRecord } from "@/services/workflowApi";
import type { EmbedConfig, WorkflowDefinition } from "@/workflow/types";
import { DEFAULT_EMBED_CONFIG } from "@/workflow/types";

export default function EmbedPage() {
  const c = useBilingualCopy();
  const { workflowId, mapId } = useParams<{ workflowId?: string; mapId?: string }>();
  const [search] = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config: EmbedConfig = { ...DEFAULT_EMBED_CONFIG, workflowId, mapId, theme: search.get("theme") === "dark" ? "dark" : search.get("theme") === "light" ? "light" : "system", showTimeSlider: search.get("showTimeSlider") === "true" };
  useEffect(() => { if (!workflowId) return; workflowApi.get(workflowId).then((record: WorkflowRecord) => setWorkflow(record.workflow)).catch(() => setError(c("Alur kerja tidak ditemukan", "Workflow not found"))); }, [workflowId, c]);
  return (
    <main className={`embed-page embed-${config.theme}`}>
      <header className="embed-header">
        <div className="embed-brand">
          <span className="embed-brand-mark"><i className="bi bi-globe2" /></span>
          <span><strong>SaveGeo</strong><small>{c("Tampilan geospasial bersama", "Shared geospatial view")}</small></span>
        </div>
        <span className="badge text-bg-light">{c("Hanya baca", "Read only")}</span>
      </header>
      <section className="embed-content">
        {error ? (
          <div className="embed-state">
            <i className="bi bi-exclamation-octagon" />
            <h1>{c("Alur kerja tidak ditemukan", "Workflow not found")}</h1>
            <p>{c("Alur kerja bersama ini mungkin privat, telah dihapus, atau kedaluwarsa.", "This shared workflow may be private, deleted, or expired.")}</p>
          </div>
        ) : workflow ? (
          <>
            <div className="embed-hero">
              <span className="workflow-eyebrow">{c("Workflow bersama", "Shared workflow")}</span>
              <h1>{workflow.name}</h1>
              <p>{workflow.description || c("Konfigurasi analisis yang dibagikan dari SaveGeo.", "Analysis configuration shared from SaveGeo.")}</p>
            </div>
            <div className="embed-map-placeholder">
              <div className="embed-map-grid" />
              <div className="embed-map-center">
                <i className="bi bi-badge-3d" />
                <strong>{c("Tampilan analisis 3D", "3D analysis view")}</strong>
                <span>{workflow.nodes.length} {c("node workflow", "workflow nodes")} · {workflow.category}</span>
              </div>
              <div className="embed-layer-stack">
                {workflow.nodes.filter((node) => node.type.includes("3d") || node.type.includes("layer") || node.type.includes("export")).map((node) => <span key={node.id}><i className="bi bi-layers" /> {node.label}</span>)}
              </div>
            </div>
            {config.showTimeSlider && <label className="embed-time"><span>{c("Waktu", "Time")}</span><input type="range" min="0" max="365" defaultValue="150" /><output>2026-06-01</output></label>}
            <div className="embed-footer">
              <span><i className="bi bi-shield-check me-1" /> {c("Sematan hanya baca · tidak ada kredensial yang dibagikan", "Read-only embed · no credentials exposed")}</span>
              <span>{config.allowInteraction ? c("Interaktif", "Interactive") : c("Statis", "Static")}</span>
            </div>
          </>
        ) : (
          <div className="embed-state"><div className="spinner-border text-success" role="status" /><p>{c("Memuat tampilan bersama…", "Loading shared view…")}</p></div>
        )}
        {!workflow && mapId && !error && <div className="embed-state"><h1>{c("Peta", "Map")} {mapId}</h1><p>{c("Sematan peta siap menampilkan layer yang telah dipublikasikan.", "Map embed is ready for a published layer.")}</p></div>}
      </section>
    </main>
  );
}
