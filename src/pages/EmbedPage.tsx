import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { workflowApi, type WorkflowRecord } from "@/services/workflowApi";
import type { EmbedConfig, WorkflowDefinition } from "@/workflow/types";
import { DEFAULT_EMBED_CONFIG } from "@/workflow/types";

export default function EmbedPage() {
  const { workflowId, mapId } = useParams<{ workflowId?: string; mapId?: string }>();
  const [search] = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config: EmbedConfig = { ...DEFAULT_EMBED_CONFIG, workflowId, mapId, theme: search.get("theme") === "dark" ? "dark" : search.get("theme") === "light" ? "light" : "system", showTimeSlider: search.get("showTimeSlider") === "true" };
  useEffect(() => { if (!workflowId) return; workflowApi.get(workflowId).then((record: WorkflowRecord) => setWorkflow(record.workflow)).catch(() => setError("WORKFLOW_NOT_FOUND")); }, [workflowId]);
  return <main className={`embed-page embed-${config.theme}`}><header className="embed-header"><div className="embed-brand"><span className="embed-brand-mark"><i className="bi bi-globe2" /></span><span><strong>SaveGeo</strong><small>Shared geospatial view</small></span></div><span className="badge text-bg-light">Read only</span></header><section className="embed-content">{error ? <div className="embed-state"><i className="bi bi-exclamation-octagon" /><h1>Workflow not found</h1><p>This shared workflow may be private, deleted, or expired.</p></div> : workflow ? <><div className="embed-hero"><span className="workflow-eyebrow">Shared workflow</span><h1>{workflow.name}</h1><p>{workflow.description || "Analysis configuration shared from SaveGeo."}</p></div><div className="embed-map-placeholder"><div className="embed-map-grid" /><div className="embed-map-center"><i className="bi bi-badge-3d" /><strong>3D analysis view</strong><span>{workflow.nodes.length} workflow nodes · {workflow.category}</span></div><div className="embed-layer-stack">{workflow.nodes.filter((node) => node.type.includes("3d") || node.type.includes("layer") || node.type.includes("export")).map((node) => <span key={node.id}><i className="bi bi-layers" /> {node.label}</span>)}</div></div>{config.showTimeSlider && <label className="embed-time"><span>Time</span><input type="range" min="0" max="365" defaultValue="150" /><output>2026-06-01</output></label>}<div className="embed-footer"><span><i className="bi bi-shield-check me-1" /> Read-only embed · no credentials exposed</span><span>{config.allowInteraction ? "Interactive" : "Static"}</span></div></> : <div className="embed-state"><div className="spinner-border text-success" role="status" /><p>Loading shared view…</p></div>}{!workflow && mapId && !error && <div className="embed-state"><h1>Map {mapId}</h1><p>Map embed is ready for a published layer.</p></div>}</section></main>;
}
