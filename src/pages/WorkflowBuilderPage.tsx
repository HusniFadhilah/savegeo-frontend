import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { workflowApi, type WorkflowRecord } from "@/services/workflowApi";
import { executeWorkflow } from "@/workflow/engine";
import { clearWorkflowDraft, loadWorkflowDraft, saveWorkflowDraft } from "@/workflow/storage";
import { NODE_CATALOG, WORKFLOW_TEMPLATES } from "@/workflow/templates";
import type { Layer3DDefinition, WorkflowDefinition, WorkflowNode, WorkflowRun } from "@/workflow/types";
import { canonicalWorkflowUrl, parseWorkflowQuery, updateWorkflowQuery } from "@/workflow/queryState";
import { validateWorkflow } from "@/workflow/validation";
import { createExtrusionStyle } from "@/services/layer3dAdapter";

const emptyWorkflow = (): WorkflowDefinition => ({ version: 1, schemaVersion: 1, name: "Untitled workflow", description: "", category: "general", visibility: "private", inputs: [], nodes: [], edges: [] });
const normalizeRecord = (record: WorkflowRecord): WorkflowDefinition => ({ ...record.workflow, id: record.id, name: record.name, description: record.description, category: record.category, visibility: record.visibility, version: 1, schemaVersion: 1 });
const layerDefaults: Layer3DDefinition[] = [{ id: "terrain", name: "Terrain", type: "terrain", visible: true, opacity: 1, source: "cesium://terrain", metadata: { quality: "adaptive" } }, { id: "severity-hotspot", name: "Severity hotspots", type: "hotspot", visible: true, opacity: 0.85, source: "workflow://latest-output", time: { start: "2026-01-01", end: "2026-12-31" } }];

export default function WorkflowBuilderPage() {
  const { id, action } = useParams<{ id?: string; action?: string }>();
  const queryWorkflowId = parseWorkflowQuery(window.location.search).workflowId;
  const workflowId = id || queryWorkflowId;
  const navigate = useNavigate();
  const t = useI18nStore((state) => state.t);
  const isAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(() => {
    const query = parseWorkflowQuery(window.location.search);
    if (query.steps?.length) {
      const template = WORKFLOW_TEMPLATES.find((item) => item.nodes.map((node) => node.type).join(",") === query.steps!.join(","));
      if (template) return structuredClone(template);
      const labels = new Map<string, string>();
      NODE_CATALOG.forEach(([, nodes]) => nodes.forEach(([type, label]) => labels.set(type, label)));
      const nodes = query.steps.map((type, index) => ({ id: `${type}-${index + 1}`, type, label: labels.get(type) || type.replace(/_/g, " "), position: { x: 24 + index * 176, y: 140 }, params: {} } satisfies WorkflowNode));
      return { ...emptyWorkflow(), name: "Deep-link workflow", nodes, edges: nodes.slice(1).map((current, index) => ({ id: `edge-${index + 1}`, source: nodes[index].id, target: current.id })) };
    }
    return loadWorkflowDraft() || emptyWorkflow();
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [layers, setLayers] = useState(layerDefaults);
  const [activeTime, setActiveTime] = useState(parseWorkflowQuery(window.location.search).time || "2026-06-01");

  useEffect(() => {
    if (!workflowId) return;
    workflowApi.get(workflowId).then((record) => setWorkflow(normalizeRecord(record))).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "WORKFLOW_NOT_FOUND"));
  }, [workflowId]);

  useEffect(() => { saveWorkflowDraft(workflow); }, [workflow]);
  useEffect(() => { if (activeTime) updateWorkflowQuery({ workflowId: workflow.id || workflowId, time: activeTime, view: layers.some((layer) => layer.type !== "raster-overlay" && layer.visible) ? "3d" : "2d" }); }, [activeTime, workflow.id, workflowId, layers]);

  const validation = useMemo(() => validateWorkflow(workflow), [workflow]);
  const filteredCatalog = useMemo(() => NODE_CATALOG.map(([category, nodes]) => [category, nodes.filter(([, label]) => label.toLowerCase().includes(search.toLowerCase()))] as const).filter(([, nodes]) => nodes.length), [search]);
  const updateNode = (idToUpdate: string, patch: Partial<WorkflowNode>) => setWorkflow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === idToUpdate ? { ...node, ...patch } : node) }));

  const addNode = (type: string, label: string, x = 40, y = 80) => {
    const newNode = { id: `${type}-${Date.now()}`, type, label, position: { x, y }, params: {} } satisfies WorkflowNode;
    setWorkflow((current) => ({ ...current, nodes: [...current.nodes, newNode], edges: current.nodes.length ? [...current.edges, { id: `edge-${Date.now()}`, source: current.nodes[current.nodes.length - 1].id, target: newNode.id }] : current.edges }));
    setSelectedNode(newNode.id);
  };

  const loadTemplate = (template: WorkflowDefinition) => { setWorkflow(structuredClone(template)); setNotice("Template loaded"); setError(null); };
  const save = async () => {
    if (!validation.valid) { setError(validation.errors.join(" · ")); return; }
    if (!isAuthenticated) { setNotice("Draft tersimpan di browser. Login untuk menyimpan ke server."); return; }
    try {
      const record = workflow.id ? await workflowApi.update(workflow.id, workflow) : await workflowApi.create(workflow);
      const next = normalizeRecord(record);
      setWorkflow(next); setNotice("Workflow saved"); if (!workflow.id) navigate(`/workflow/${record.id}/edit`, { replace: true });
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Failed to save workflow"); }
  };
  const share = async () => {
    if (!workflow.id) { setError("Save workflow before sharing"); return; }
    try { await workflowApi.share(workflow.id); const url = `${window.location.origin}${canonicalWorkflowUrl("/workflow", { workflowId: workflow.id })}`; await navigator.clipboard?.writeText(url); setWorkflow((current) => ({ ...current, visibility: "unlisted" })); setNotice("Share link copied"); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Share failed"); }
  };
  const runWorkflow = async () => {
    if (!validation.valid) { setError(validation.errors.join(" · ")); return; }
    abortRef.current = new AbortController(); setRunning(true); setError(null);
    try { const next = await executeWorkflow(workflow, "auto", setRun, abortRef.current.signal); setRun(next); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "NODE_EXECUTION_FAILED"); } finally { setRunning(false); }
  };
  const stop = () => { abortRef.current?.abort(); setRunning(false); };
  const selected = workflow.nodes.find((node) => node.id === selectedNode);

  return <div className="workflow-page"><Navbar /><main className="workflow-shell" aria-label={t("workflow.modelBuilder")}>
    <header className="workflow-header"><div><div className="workflow-eyebrow"><i className="bi bi-diagram-3" /> SaveGeo {t("workflow.title")}</div><input className="workflow-title-input" value={workflow.name} onChange={(event) => setWorkflow({ ...workflow, name: event.target.value })} aria-label="Workflow name" /><p>Bangun analisis geospasial yang dapat diulang, dibagikan, dan ditelusuri.</p></div><div className="workflow-actions"><Link className="btn btn-light btn-sm" to="/workflow"><i className="bi bi-collection me-1" /> {t("workflow.templates")}</Link><label className="btn btn-light btn-sm mb-0"><i className="bi bi-box-arrow-in-down me-1" /> {t("workflow.importExport")}<input type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then((text) => { try { setWorkflow(JSON.parse(text) as WorkflowDefinition); setNotice("Workflow imported"); } catch { setError("WORKFLOW_INVALID"); } }); }} /></label><button className="btn btn-outline-secondary btn-sm" onClick={() => { clearWorkflowDraft(); setWorkflow(emptyWorkflow()); }}><i className="bi bi-trash3 me-1" /> Hapus draft</button><button className="btn btn-outline-primary btn-sm" onClick={() => void share()} disabled={!workflow.id}><i className="bi bi-share me-1" /> {t("workflow.share")}</button><button className="btn btn-primary btn-sm" onClick={() => void save()}><i className="bi bi-cloud-arrow-up me-1" /> {t("workflow.save")}</button><button className="btn btn-success btn-sm" onClick={() => void runWorkflow()} disabled={running || !workflow.nodes.length}><i className="bi bi-play-fill me-1" /> {running ? "Running…" : t("workflow.run")}</button>{running && <button className="btn btn-outline-danger btn-sm" onClick={stop}>{t("workflow.cancel")}</button>}</div></header>
    {(notice || error) && <div className={`workflow-alert ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}><i className={`bi ${error ? "bi-exclamation-triangle" : "bi-check-circle"}`} /> {error || notice}<button type="button" onClick={() => { setError(null); setNotice(null); }} aria-label="Dismiss">×</button></div>}
    <section className="workflow-layout"><aside className="workflow-panel workflow-library"><div className="panel-heading"><span>{t("workflow.modelBuilder")}</span><span className="badge text-bg-light">{workflow.nodes.length}</span></div><input className="form-control form-control-sm mb-3" placeholder="Search nodes…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search nodes" />{filteredCatalog.map(([category, nodes]) => <div key={category} className="node-group"><small>{category}</small>{nodes.map(([type, label]) => <button key={type} draggable onDragStart={(event) => event.dataTransfer.setData("application/savegeo-node", JSON.stringify({ type, label }))} onClick={() => addNode(type, label)} className="node-library-item"><i className="bi bi-plus-circle" /> {label}</button>)}</div>)}<div className="template-mini-list"><div className="panel-heading"><span>{t("workflow.templates")}</span></div>{WORKFLOW_TEMPLATES.map((template) => <button key={template.name} className="template-mini" onClick={() => loadTemplate(template)}><span>{template.name}</span><small>{template.nodes.length} nodes</small></button>)}</div><Link to="/settings/plugins" className="plugin-link"><i className="bi bi-puzzle me-2" /> {t("workflow.plugin")} manager</Link></aside>
      <div className="workflow-canvas-wrap"><div className="canvas-toolbar"><span><i className="bi bi-arrows-move me-1" /> Canvas</span><span className={validation.valid ? "text-success" : "text-danger"}><i className={`bi ${validation.valid ? "bi-check-circle" : "bi-x-circle"}`} /> {validation.valid ? "Valid" : `${validation.errors.length} errors`}</span><button className="btn btn-sm btn-outline-secondary" onClick={() => { const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${workflow.name.replace(/\W+/g, "-").toLowerCase()}.json`; anchor.click(); URL.revokeObjectURL(url); }}>Export JSON</button></div><div className="workflow-canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const data = event.dataTransfer.getData("application/savegeo-node"); if (!data) return; const nodeData = JSON.parse(data) as { type: string; label: string }; const rect = event.currentTarget.getBoundingClientRect(); addNode(nodeData.type, nodeData.label, Math.max(12, event.clientX - rect.left - 70), Math.max(12, event.clientY - rect.top - 30)); }}><svg className="workflow-edges" aria-hidden="true">{workflow.edges.map((edge) => { const source = workflow.nodes.find((node) => node.id === edge.source); const target = workflow.nodes.find((node) => node.id === edge.target); return source && target ? <line key={edge.id} x1={source.position.x + 140} y1={source.position.y + 32} x2={target.position.x} y2={target.position.y + 32} /> : null; })}</svg>{workflow.nodes.length === 0 && <div className="canvas-empty"><i className="bi bi-boxes" /><strong>Drop a node here</strong><span>Pilih node di kiri atau gunakan template untuk memulai.</span></div>}{workflow.nodes.map((node) => <button key={node.id} className={`workflow-node ${selectedNode === node.id ? "selected" : ""} ${run?.nodeStatuses[node.id] || ""}`} style={{ left: node.position.x, top: node.position.y }} onClick={() => setSelectedNode(node.id)} aria-label={`Select ${node.label}`}><span className="workflow-node-port left" /><span className="workflow-node-icon"><i className={`bi ${node.type.includes("load") ? "bi-download" : node.type.includes("export") ? "bi-box-arrow-up" : node.type.includes("3d") ? "bi-badge-3d" : "bi-stars"}`} /></span><span><strong>{node.label}</strong><small>{node.type}</small></span><span className="workflow-node-port right" /></button>)}</div></div>
      <aside className="workflow-panel workflow-inspector"><div className="panel-heading">Inspector</div><label className="form-label small">Visibility<select className="form-select form-select-sm" value={workflow.visibility} onChange={(event) => setWorkflow({ ...workflow, visibility: event.target.value as WorkflowDefinition["visibility"] })}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>{selected ? <><label className="form-label small">Node label<input className="form-control form-control-sm" value={selected.label} onChange={(event) => updateNode(selected.id, { label: event.target.value })} /></label><label className="form-label small">Node type<input className="form-control form-control-sm" value={selected.type} readOnly /></label><label className="form-label small">Parameters (JSON)<textarea className="form-control form-control-sm" rows={6} value={JSON.stringify(selected.params, null, 2)} onChange={(event) => { try { updateNode(selected.id, { params: JSON.parse(event.target.value) }); } catch { /* wait for valid JSON */ } }} /></label><button className="btn btn-outline-danger btn-sm w-100" onClick={() => { setWorkflow({ ...workflow, nodes: workflow.nodes.filter((node) => node.id !== selected.id), edges: workflow.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id) }); setSelectedNode(null); }}><i className="bi bi-x-circle me-1" /> Delete node</button></> : <div className="inspector-empty"><i className="bi bi-cursor" /><p>Select a node to edit parameters.</p></div>}<hr /><div className="panel-heading">{t("workflow.layer3d")}</div>{layers.map((layer) => <div className="layer-row" key={layer.id}><label><input type="checkbox" checked={layer.visible} onChange={(event) => setLayers(layers.map((item) => item.id === layer.id ? { ...item, visible: event.target.checked } : item))} /> {layer.name}</label><input type="range" min="0" max="1" step="0.05" value={layer.opacity ?? 1} onChange={(event) => setLayers(layers.map((item) => item.id === layer.id ? { ...item, opacity: Number(event.target.value) } : item))} aria-label={`${layer.name} opacity`} /></div>)}<button className="btn btn-sm btn-outline-success w-100 mt-2" onClick={() => setLayers([...layers, { id: `extrusion-${Date.now()}`, name: "AOI extrusion", type: "extrusion", visible: true, opacity: .55, source: "workflow://aoi", style: createExtrusionStyle() }])}><i className="bi bi-plus-circle me-1" /> Add 3D extrusion</button><label className="form-label small mt-3">{t("workflow.timeSlider")} <output>{activeTime}</output><input type="date" className="form-control form-control-sm" value={activeTime} onChange={(event) => { setActiveTime(event.target.value); updateWorkflowQuery({ workflowId: workflow.id || workflowId, time: event.target.value }); }} /></label>{run && <div className="run-card" role="status"><strong><i className="bi bi-activity me-1" /> {run.status}</strong><div className="progress mt-2"><div className="progress-bar" style={{ width: `${Math.round(Object.values(run.nodeStatuses).filter((status) => status === "completed").length / Math.max(1, workflow.nodes.length) * 100)}%` }} /></div><Link to={`/workflow/${workflow.id || "local"}/run`} className="small d-block mt-2">View provenance</Link></div>}</aside></section>
    {action === "run" && <div className="workflow-run-banner">Run details are shown in the inspector. <button onClick={() => navigate(`/workflow/${workflowId}/edit`)}>Back to editor</button></div>}
  </main></div>;
}
