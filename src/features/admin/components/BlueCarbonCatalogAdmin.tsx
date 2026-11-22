import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "../AdminContext";
import { getConfig, saveConfig } from "../api";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";
import InfoTip from "@/components/ui/InfoTip";
import { safeHttpUrl } from "@/utils/safeHttpUrl";
import { useI18nStore } from "@/hooks/useI18nStore";

const CONFIG_KEY = "carbon.bluecarbon_profiles";
const POOLS = [
  ["agb", "AGB"],
  ["bgb", "BGB"],
  ["soc", "SOC"],
  ["litter", "Litter"],
  ["deadwood", "Deadwood"],
] as const;

type BlueCarbonRecord = {
  id: string;
  name: string;
  habitat: string;
  data_kind: string;
  region: string;
  period: string;
  resolution_m: number | null;
  source_name: string;
  source_url: string;
  citation: string;
  notes: string;
  status: "draft" | "published";
  values: Partial<Record<(typeof POOLS)[number][0], number | null>>;
  updated_at: string;
};

const emptyRecord = (): BlueCarbonRecord => ({
  id: "",
  name: "",
  habitat: "Mangrove",
  data_kind: "dataset",
  region: "",
  period: "",
  resolution_m: null,
  source_name: "",
  source_url: "",
  citation: "",
  notes: "",
  status: "draft",
  values: {},
  updated_at: "",
});

function parseRecords(raw?: string | null): BlueCarbonRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is BlueCarbonRecord => Boolean(item && typeof item === "object" && "id" in item)) : [];
  } catch {
    return [];
  }
}

export default function BlueCarbonCatalogAdmin() {
  const t = useI18nStore((state) => state.t);
  const poolLabel = (key: string, fallback: string) => key === "soc" ? t("admin.calibration.pool.soc") : key === "litter" ? t("admin.calibration.pool.litter") : key === "deadwood" ? t("admin.calibration.pool.deadwood") : fallback;
  const { notify } = useAdmin();
  const user = useAuthStore((state) => state.user);
  const canWrite = hasAdminPermission(user, "config.write");
  const [records, setRecords] = useState<BlueCarbonRecord[]>([]);
  const [draft, setDraft] = useState<BlueCarbonRecord>(emptyRecord());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { config } = await getConfig();
      const setting = Object.values(config).flat().find((item) => item.key === CONFIG_KEY);
      setRecords(parseRecords(setting?.raw_value));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("admin.blueCarbon.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void reload(); }, [reload]);

  const patch = (update: Partial<BlueCarbonRecord>) => setDraft((current) => ({ ...current, ...update }));
  const patchValue = (key: (typeof POOLS)[number][0], value: string) => {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [key]: value.trim() === "" ? null : Number(value) },
    }));
  };

  const poolValueCount = (record: BlueCarbonRecord) => POOLS.filter(([key]) => record.values?.[key] != null).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    if (draft.source_url && !/^https:\/\//i.test(draft.source_url)) {
      setError(t("admin.blueCarbon.httpsRequired"));
      return;
    }
    const next = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      resolution_m: draft.resolution_m == null ? null : Number(draft.resolution_m),
      updated_at: new Date().toISOString(),
    };
    const updated = [next, ...records.filter((record) => record.id !== next.id)];
    setSaving(true);
    setError(null);
    try {
      const response = await saveConfig([{ key: CONFIG_KEY, value: JSON.stringify(updated) }]);
      if (response.errors.length) throw new Error(response.errors.map((item) => item.error).join("; "));
      setRecords(updated);
      setDraft(emptyRecord());
      notify(t("admin.blueCarbon.saved"), "s");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("admin.blueCarbon.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(recordId: string) {
    if (!canWrite) return;
    const updated = records.filter((record) => record.id !== recordId);
    setSaving(true);
    try {
      const response = await saveConfig([{ key: CONFIG_KEY, value: JSON.stringify(updated) }]);
      if (response.errors.length) throw new Error(response.errors.map((item) => item.error).join("; "));
      setRecords(updated);
      notify(t("admin.blueCarbon.deleted"), "s");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("admin.blueCarbon.deleteFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bluecarbon-admin" aria-labelledby="bluecarbon-admin-title">
      <div className="bluecarbon-admin__intro">
        <div className="bluecarbon-admin__intro-copy">
          <span className="bluecarbon-admin__eyebrow">{t("admin.blueCarbon.eyebrow")}</span>
          <div className="bluecarbon-admin__title-row">
            <h2 id="bluecarbon-admin-title">{t("admin.blueCarbon.title")}</h2>
            <InfoTip
              label={t("admin.blueCarbon.catalogTip")}
              content={<>{t("admin.blueCarbon.descriptionStart")} <strong>{t("admin.blueCarbon.published")}</strong> {t("admin.blueCarbon.descriptionEnd")}</>}
            />
          </div>
        </div>
        <span className="bluecarbon-admin__count"><i className="bi bi-database" aria-hidden="true" /> {records.length} {t("admin.blueCarbon.records")}</span>
      </div>

      {error && <div className="alert alert-warning py-2" role="alert">{error}</div>}
      {loading ? <div className="bluecarbon-admin__loading" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {t("admin.blueCarbon.loading")}</div> : (
        <div className="bluecarbon-admin__layout">
          {canWrite ? (
            <section className="bluecarbon-admin__card" aria-labelledby="bluecarbon-form-title">
              <header className="bluecarbon-admin__card-header">
                <div className="bluecarbon-admin__card-heading">
                  <span className="bluecarbon-admin__header-icon"><i className="bi bi-plus-lg" aria-hidden="true" /></span>
                  <h3 id="bluecarbon-form-title">{draft.id ? t("admin.blueCarbon.editRecord") : t("admin.blueCarbon.addRecord")}</h3>
                  <InfoTip
                    label={t("admin.blueCarbon.formTip")}
                    content={t("admin.blueCarbon.formHelp")}
                  />
                </div>
                {draft.id && <button type="button" className="btn btn-sm btn-light bluecarbon-admin__cancel" onClick={() => setDraft(emptyRecord())}><i className="bi bi-x-lg" aria-hidden="true" /> {t("admin.blueCarbon.cancelEdit")}</button>}
              </header>
              <form className="bluecarbon-admin__form" onSubmit={(event) => void submit(event)}>
                <div className="bluecarbon-admin__fields">
                  <label>{t("admin.blueCarbon.name")}<input required className="form-control" value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
                  <label>{t("admin.blueCarbon.habitat")}<select className="form-select" value={draft.habitat} onChange={(event) => patch({ habitat: event.target.value })}><option value="Mangrove">Mangrove</option><option value="Lamun">{t("admin.blueCarbon.seagrass")}</option><option value="Rawa asin">{t("admin.blueCarbon.saltmarsh")}</option><option value="Ekosistem pesisir lainnya">{t("admin.blueCarbon.otherCoastal")}</option></select></label>
                  <label>{t("admin.blueCarbon.sourceKind")}<select className="form-select" value={draft.data_kind} onChange={(event) => patch({ data_kind: event.target.value })}><option value="dataset">{t("admin.blueCarbon.geospatialDataset")}</option><option value="field_observation">{t("admin.blueCarbon.fieldMeasurement")}</option><option value="literature">{t("admin.blueCarbon.literature")}</option></select></label>
                  <label>{t("admin.blueCarbon.region")}<input className="form-control" value={draft.region} onChange={(event) => patch({ region: event.target.value })} placeholder={t("admin.blueCarbon.regionPlaceholder")} /></label>
                  <label>{t("admin.blueCarbon.period")}<input className="form-control" value={draft.period} onChange={(event) => patch({ period: event.target.value })} placeholder={t("admin.blueCarbon.periodPlaceholder")} /></label>
                  <label>{t("admin.blueCarbon.resolution")}<input type="number" min="0" step="any" className="form-control" value={draft.resolution_m ?? ""} onChange={(event) => patch({ resolution_m: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                  <label>{t("admin.blueCarbon.provider")}<input required className="form-control" value={draft.source_name} onChange={(event) => patch({ source_name: event.target.value })} /></label>
                  <label>{t("admin.blueCarbon.sourceUrl")}<input type="url" className="form-control" value={draft.source_url} onChange={(event) => patch({ source_url: event.target.value })} placeholder="https://…" /></label>
                  <label>{t("admin.blueCarbon.publicStatus")}<select className="form-select" value={draft.status} onChange={(event) => patch({ status: event.target.value as BlueCarbonRecord["status"] })}><option value="draft">{t("admin.blueCarbon.draftAdmin")}</option><option value="published">{t("admin.blueCarbon.publishUsers")}</option></select></label>
                </div>
                <div className="bluecarbon-admin__pool-section">
                  <div className="bluecarbon-admin__subheading"><h4>{t("admin.blueCarbon.poolValues")}</h4><span>Mg C/ha</span><InfoTip label={t("admin.blueCarbon.poolTip")} content={t("admin.blueCarbon.poolHelp")} /></div>
                  <div className="bluecarbon-admin__pool-fields">
                    {POOLS.map(([key, label]) => <label key={key}>{poolLabel(key, label)}<input type="number" min="0" step="any" className="form-control" value={draft.values[key] ?? ""} onChange={(event) => patchValue(key, event.target.value)} /></label>)}
                  </div>
                </div>
                <div className="bluecarbon-admin__fields bluecarbon-admin__fields--references">
                  <label className="bluecarbon-admin__wide">{t("admin.blueCarbon.citation")}<input className="form-control" value={draft.citation} onChange={(event) => patch({ citation: event.target.value })} placeholder={t("admin.blueCarbon.citationPlaceholder")} /></label>
                  <label className="bluecarbon-admin__wide">{t("admin.blueCarbon.methodNotes")}<textarea rows={2} className="form-control" value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
                </div>
                <div className="bluecarbon-admin__form-actions">
                  <button type="submit" className="btn btn-success" disabled={saving}><i className={`bi ${saving ? "bi-arrow-repeat" : "bi-check2"}`} aria-hidden="true" /> {saving ? t("admin.saving") : t("admin.blueCarbon.saveRecord")}</button>
                </div>
              </form>
            </section>
          ) : <div className="alert alert-info mb-0">{t("admin.blueCarbon.readOnly")} <code>config.write</code> {t("admin.blueCarbon.configWriteRequired")}</div>}

          <section className="bluecarbon-admin__card" aria-labelledby="bluecarbon-records-title">
            <header className="bluecarbon-admin__card-header">
              <div className="bluecarbon-admin__card-heading">
                <span className="bluecarbon-admin__header-icon"><i className="bi bi-collection" aria-hidden="true" /></span>
                <h3 id="bluecarbon-records-title">{t("admin.blueCarbon.recordsList")}</h3>
                <InfoTip label={t("admin.blueCarbon.recordsTip")} content={t("admin.blueCarbon.recordsHelp")} />
              </div>
              <span className="bluecarbon-admin__header-count">{records.length}</span>
            </header>
            <div className="bluecarbon-admin__records">
              {!records.length ? (
                <div className="bluecarbon-admin__empty"><span><i className="bi bi-water" aria-hidden="true" /></span><strong>{t("admin.blueCarbon.empty")}</strong><small>{t("admin.blueCarbon.emptyHint")}</small></div>
              ) : records.map((record) => (
                <article className="bluecarbon-admin__record" key={record.id}>
                  <span className="bluecarbon-admin__record-icon"><i className="bi bi-tree" aria-hidden="true" /></span>
                  <div className="bluecarbon-admin__record-main">
                    <div className="bluecarbon-admin__record-title"><strong>{record.name}</strong><span className={`bluecarbon-admin__status ${record.status === "published" ? "is-published" : "is-draft"}`}>{record.status === "published" ? t("admin.blueCarbon.public") : t("admin.blueCarbon.draft")}</span></div>
                    <div className="bluecarbon-admin__record-meta"><span>{record.habitat === "Lamun" ? t("admin.blueCarbon.seagrass") : record.habitat === "Rawa asin" ? t("admin.blueCarbon.saltmarsh") : record.habitat === "Ekosistem pesisir lainnya" ? t("admin.blueCarbon.otherCoastal") : record.habitat}</span><span>{record.region || t("admin.blueCarbon.regionMissing")}</span><span>{record.period || t("admin.blueCarbon.periodMissing")}</span></div>
                    <div className="bluecarbon-admin__record-footer">
                      <span><i className="bi bi-database" aria-hidden="true" /> {record.source_name || t("admin.blueCarbon.sourceMissing")}</span>
                      <span><i className="bi bi-layers" aria-hidden="true" /> {poolValueCount(record)} {t("admin.blueCarbon.of")} {POOLS.length} {t("admin.blueCarbon.pool")}</span>
                      <InfoTip label={`${t("admin.blueCarbon.sourceCitation")} ${record.name}`} content={<>{record.citation && <span>{record.citation}</span>}{record.notes && <p className="mb-0 mt-1">{record.notes}</p>}{safeHttpUrl(record.source_url) && <a href={safeHttpUrl(record.source_url)} target="_blank" rel="noopener noreferrer">{t("admin.blueCarbon.openSource")}</a>}{!record.citation && !record.notes && !record.source_url && <span>{t("admin.blueCarbon.noCitation")}</span>}</>} />
                    </div>
                  </div>
                  {canWrite && <div className="bluecarbon-admin__record-actions">
                    <button type="button" className="bluecarbon-admin__icon-button" disabled={saving} onClick={() => setDraft(record)} aria-label={`${t("admin.blueCarbon.editTitle")} ${record.name}`} title={t("admin.blueCarbon.editTitle")}><i className="bi bi-pencil-square" /></button>
                    <button type="button" className="bluecarbon-admin__icon-button is-danger" disabled={saving} onClick={() => void remove(record.id)} aria-label={`${t("admin.blueCarbon.deleteTitle")} ${record.name}`} title={t("admin.blueCarbon.deleteTitle")}><i className="bi bi-trash3" /></button>
                  </div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
