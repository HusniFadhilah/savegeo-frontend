import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { apiClient } from "@/services/apiClient";
import { clearGeospatialCache } from "@/geospatial/cache";
import { getCloudDataset, listCloudDatasets, registerCloudDataset } from "@/geospatial/datasetCatalog";
import { openCog } from "@/geospatial/cogReader";
import { readPMTilesMetadata } from "@/geospatial/pmtiles";
import { getSpatialQueryService } from "@/geospatial/spatialQuery";
import { readCloudDatasetQuery, writeCloudDatasetQuery } from "@/geospatial/queryState";
import type { CloudDatasetFormat, CloudDatasetReference } from "@/geospatial/types";
import "./cloudDataset.css";

type Props = { module?: string };
type LocalFile = { file: File; reference: CloudDatasetReference };

const formatForFile = (file: File): CloudDatasetFormat => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".parquet")) return "geoparquet";
  if (name.endsWith(".pmtiles")) return "pmtiles";
  return "cog";
};

export default function CloudDatasetPanel({ module }: Props) {
  const moduleKey = module ?? "admin";
  const t = useI18nStore((state) => state.t);
  const [datasets, setDatasets] = useState<CloudDatasetReference[]>([]);
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [metadata, setMetadata] = useState<unknown>(null);
  const [query, setQuery] = useState("SELECT * FROM scenes");
  const [rows, setRows] = useState<unknown[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadCatalog = useCallback(async () => {
    setBusy(true);
    try { setDatasets(await listCloudDatasets(module ? { module } : undefined)); setNotice(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : t("errors.serverUnavailable")); }
    finally { setBusy(false); }
  }, [module, t]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  useEffect(() => { const reference = readCloudDatasetQuery(); if (reference) setSelectedId(reference.id); }, [datasets.length]);

  const selected = useMemo(() => datasets.find((item) => item.id === selectedId) ?? localFiles.find((item) => item.reference.id === selectedId)?.reference, [datasets, localFiles, selectedId]);

  const addLocalFile = async (file: File) => {
    const format = formatForFile(file);
    const id = `local-${moduleKey}-${Date.now().toString(36)}`;
    const reference: CloudDatasetReference = { id, name: file.name, format, access: "private", sourceType: "local-file", mimeType: file.type || undefined, sizeBytes: file.size, module: moduleKey };
    setLocalFiles((current) => [...current, { file, reference }]);
    setSelectedId(id);
    try { await registerCloudDataset(reference); } catch { /* local-only references remain usable in this browser */ }
    setNotice(`${file.name} · ${format.toUpperCase()} · ${t("cloud.browser")}`);
  };

  const inspect = async () => {
    if (!selected) return;
    setBusy(true); setNotice("");
    try {
      const local = localFiles.find((item) => item.reference.id === selected.id);
      if (selected.format === "cog") {
        const reference = local ? local.reference : await getCloudDataset(selected.id);
        const reader = await openCog(reference, local?.file);
        setMetadata(await reader.getMetadata()); await reader.close();
      } else if (selected.format === "pmtiles") {
        setMetadata(await readPMTilesMetadata({ id: selected.id, name: selected.name, kind: "vector", url: selected.url }, local?.file));
      } else {
        const spatial = getSpatialQueryService(); await spatial.initialize();
        if (local) await spatial.registerFile(local.file, local.reference.name);
        setMetadata({ format: "GeoParquet", source: local ? "local-file" : "browser-cache", hint: "Use Spatial SQL to preview selected columns." });
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : t("cloud.queryResult")); }
    finally { setBusy(false); }
  };

  const runQuery = async () => {
    setBusy(true); setNotice("");
    try {
      const service = getSpatialQueryService(); await service.initialize();
      const local = selected && localFiles.find((item) => item.reference.id === selected.id);
      if (local) await service.registerFile(local.file, local.reference.name);
      setRows(await service.query(query)); setNotice(t("cloud.browser"));
    } catch {
      try {
        const job = await apiClient.post<{ id: string }>("/geospatial/query", { sql: query, params: [], limit: 1000 }, { auth: "app" });
        setRows([]); setNotice(`${t("cloud.server")} · ${job.id}`);
      } catch (fallbackError) { setNotice(fallbackError instanceof Error ? fallbackError.message : t("spatial.operationFailed")); }
    } finally { setBusy(false); }
  };

  const clearCache = async () => { await clearGeospatialCache(); setNotice(t("cloud.clearCache")); };

  if (module === "guide" || module === "about") return null;
  return (
    <section className="cloud-dataset-panel" aria-labelledby="cloud-dataset-title">
      <div className="cloud-dataset-heading">
        <div><span className="cloud-eyebrow">{t("cloud.browser")}</span><h2 id="cloud-dataset-title">{t("cloud.title")}</h2><p>{t("cloud.description")}</p></div>
        <div className="cloud-actions">
          <label className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-folder2-open" aria-hidden="true" /> {t("cloud.file")}
            <input className="visually-hidden" type="file" accept=".tif,.tiff,.parquet,.pmtiles" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addLocalFile(file); event.currentTarget.value = ""; }} />
          </label>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void loadCatalog()} disabled={busy}><i className="bi bi-arrow-clockwise" aria-hidden="true" /> {t("cloud.refresh")}</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void clearCache()}><i className="bi bi-trash3" aria-hidden="true" /> {t("cloud.clearCache")}</button>
        </div>
      </div>
      <div className="cloud-dataset-grid">
        <div className="cloud-dataset-list">
          <label htmlFor="cloud-dataset-select">{t("raster.source")}</label>
          <select id="cloud-dataset-select" className="form-select" value={selectedId} onChange={(event) => { const id = event.target.value; setSelectedId(id); const current = datasets.find((item) => item.id === id) ?? localFiles.find((item) => item.reference.id === id)?.reference; if (current) writeCloudDatasetQuery(current.id, current.format); }}>
            <option value="">{t("cloud.noDatasets")}</option>
            {datasets.map((dataset) => <option value={dataset.id} key={dataset.id}>{dataset.name} · {dataset.format.toUpperCase()}</option>)}
            {localFiles.map(({ reference }) => <option value={reference.id} key={reference.id}>{reference.name} · local {reference.format.toUpperCase()}</option>)}
          </select>
          <div className="cloud-control-row"><button type="button" className="btn btn-success btn-sm" onClick={() => void inspect()} disabled={!selected || busy}>{t("cloud.inspect")}</button><span className="cloud-status">{busy ? "…" : notice || (selected ? t("cloud.live") : "")}</span></div>
        </div>
        <div className="cloud-query-box"><label htmlFor="cloud-sql">{t("cloud.query")}</label><textarea id="cloud-sql" className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} spellCheck={false} /><button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => void runQuery()} disabled={busy}>{t("cloud.runQuery")}</button></div>
      </div>
      {metadata !== null && <pre className="cloud-metadata" aria-label={t("cloud.inspect")}>{JSON.stringify(metadata, null, 2)}</pre>}
      {rows.length > 0 && <div className="cloud-results"><strong>{t("cloud.queryResult")}</strong><pre>{JSON.stringify(rows.slice(0, 100), null, 2)}</pre></div>}
    </section>
  );
}
