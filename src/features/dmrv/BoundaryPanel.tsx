import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { addBoundary, listBoundaries } from "./api";
import { describeDmrvError } from "./errors";
import type { BoundaryVersion } from "./types";

const AREA_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

/** FileReader instead of File.text(): works in every browser and in jsdom. */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function BoundaryPanel({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const [versions, setVersions] = useState<BoundaryVersion[] | null>(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<BoundaryVersion | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setVersions(await listBoundaries(projectId));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      setVersions([]);
    }
  }, [projectId, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setText(await readText(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(""); setSaved(null);
    let geojson: object;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("not an object");
      geojson = parsed;
    } catch {
      setError(t("dmrv.boundary.badJson"));
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const created = await addBoundary(projectId, geojson, reason.trim());
      setSaved(created);
      setText(""); setReason("");
      await refresh();
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const overlap = saved?.overlap;

  return (
    <section aria-labelledby="dmrv-boundary-heading" className="px-1">
      <h2 id="dmrv-boundary-heading" className="h5">{t("dmrv.boundary.heading")}</h2>
      {versions === null && <p role="status">{t("dmrv.loading")}</p>}
      {versions !== null && versions.length === 0 && <p>{t("dmrv.boundary.empty")}</p>}
      {versions !== null && versions.length > 0 && (
        <table className="table table-sm">
          <thead>
            <tr>
              <th scope="col">{t("dmrv.boundary.version")}</th>
              <th scope="col">{t("dmrv.boundary.area")}</th>
              <th scope="col">{t("dmrv.boundary.checksum")}</th>
              <th scope="col">{t("dmrv.boundary.reason")}</th>
              <th scope="col">{t("dmrv.boundary.createdBy")}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((row) => (
              <tr key={row.id}>
                <td>{row.version}</td>
                <td>{formatNumber(row.area_ha, language, AREA_FORMAT)}</td>
                <td><code>{row.checksum.slice(0, 12)}</code></td>
                <td>{row.reason}</td>
                <td>{row.created_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!canWrite && <p className="text-muted">{t("dmrv.boundary.readOnly")}</p>}
      {canWrite && (
        <form onSubmit={(event) => void submit(event)} className="card card-body">
          <div className="mb-3">
            <label className="form-label" htmlFor="dmrv-boundary-text">{t("dmrv.boundary.geojson")}</label>
            <textarea id="dmrv-boundary-text" className="form-control font-monospace" rows={6} required value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="dmrv-boundary-file">{t("dmrv.boundary.file")}</label>
            <input id="dmrv-boundary-file" type="file" accept=".geojson,.json,application/json,application/geo+json" className="form-control" onChange={(e) => void onFile(e)} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="dmrv-boundary-reason">{t("dmrv.boundary.reasonField")}</label>
            <input id="dmrv-boundary-reason" className="form-control" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <div role="alert" className="alert alert-danger">{error}</div>}
          {saved && (
            <div role="status" className="alert alert-success">
              <div>{t("dmrv.boundary.saved", { version: saved.version })}</div>
              <div>
                {overlap && overlap.other_projects > 0
                  ? t("dmrv.boundary.overlap", {
                    count: overlap.other_projects,
                    area: formatNumber(overlap.overlap_ha, language, AREA_FORMAT),
                  })
                  : t("dmrv.boundary.noOverlap")}
              </div>
            </div>
          )}
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? t("dmrv.boundary.saving") : t("dmrv.boundary.submit")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
