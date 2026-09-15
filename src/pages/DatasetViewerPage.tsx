import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCloudDataset } from "@/geospatial/datasetCatalog";
import { openCog } from "@/geospatial/cogReader";
import { readPMTilesMetadata } from "@/geospatial/pmtiles";
import { readCloudDatasetQuery } from "@/geospatial/queryState";
import type { CloudDatasetReference } from "@/geospatial/types";

export default function DatasetViewerPage() {
  const [dataset, setDataset] = useState<CloudDatasetReference | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const reference = readCloudDatasetQuery();
    if (!reference) { setError("Missing or invalid dataset reference."); return; }
    void (async () => {
      try {
        const current = await getCloudDataset(reference.id); setDataset(current);
        if (current.format === "cog") { const reader = await openCog(current); setDetail(await reader.getMetadata()); await reader.close(); }
        else if (current.format === "pmtiles") setDetail(await readPMTilesMetadata({ id: current.id, name: current.name, kind: "vector", url: current.url }));
        else setDetail({ format: "GeoParquet", hint: "Use Spatial SQL from the module dashboard to query this dataset." });
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Dataset could not be opened."); }
    })();
  }, []);
  return <main className="container py-4"><div className="card p-4"><p className="text-uppercase small text-success fw-semibold mb-1">Dataset reference viewer</p><h1 className="h4">{dataset?.name ?? "Dataset viewer"}</h1>{error && <div className="alert alert-danger">{error}</div>}{dataset && <><p className="text-muted">{dataset.id} · {dataset.format.toUpperCase()} · {dataset.access}</p><pre className="bg-body-secondary p-3 rounded overflow-auto">{JSON.stringify(detail, null, 2)}</pre><Link className="btn btn-outline-success" to={`/imagery?datasetId=${encodeURIComponent(dataset.id)}&format=${dataset.format}`}>Open in dashboard</Link></>}</div></main>;
}

