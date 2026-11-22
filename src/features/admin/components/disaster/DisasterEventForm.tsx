import { useState } from "react";
import { createDisasterEvent, updateDisasterEvent } from "../../api";
import type { DisasterEvent } from "../../types";
import { useAdmin } from "../../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";

const DISASTER_TYPE_KEYS: Record<string, string> = {
  flood: "admin.disaster.flood", landslide: "admin.disaster.landslide", forest_fire: "admin.disaster.forestFire",
  earthquake: "admin.disaster.earthquake", tsunami: "admin.disaster.tsunami", volcanic_eruption: "admin.disaster.volcanicEruption",
  storm: "admin.disaster.storm", drought: "admin.disaster.drought", other: "admin.disaster.other",
};
const SEVERITY_KEYS: Record<string, string> = { low: "admin.disaster.low", medium: "admin.disaster.medium", high: "admin.disaster.high", critical: "admin.disaster.critical" };
const STATUS_KEYS: Record<string, string> = {
  draft: "admin.disaster.draft", processing: "admin.disaster.processingStatus", ready_for_review: "admin.disaster.readyForReview",
  published: "admin.disaster.published", archived: "admin.disaster.archived",
};

/** `"Jakarta, Bogor"` <-> `["Jakarta", "Bogor"]` - province/district are JSONB
 * string-list columns on the backend, entered here as a simple comma list. */
function listToText(list?: string[] | null): string {
  return (list ?? []).join(", ");
}
function textToList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Props {
  /** Omit (or null) for create mode; pass the event for edit mode. */
  event?: DisasterEvent | null;
  onSaved: (event: DisasterEvent) => void;
  /** Omit to hide the Cancel button (e.g. when embedded as a permanent "Info" tab). */
  onCancel?: () => void;
}

export default function DisasterEventForm({ event, onSaved, onCancel }: Props) {
  const t = useI18nStore((state) => state.t);
  const disasterTypeOptions = Object.entries(DISASTER_TYPE_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  const severityOptions = Object.entries(SEVERITY_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  const statusOptions = Object.entries(STATUS_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  const { notify } = useAdmin();
  const isEdit = Boolean(event);

  const [name, setName] = useState(event?.name ?? "");
  const [disasterType, setDisasterType] = useState(event?.disaster_type ?? disasterTypeOptions[0]?.value ?? "flood");
  const [locationName, setLocationName] = useState(event?.location_name ?? "");
  const [province, setProvince] = useState(listToText(event?.province));
  const [district, setDistrict] = useState(listToText(event?.district));
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [startDate, setStartDate] = useState(event?.start_date ?? "");
  const [endDate, setEndDate] = useState(event?.end_date ?? "");
  const [severity, setSeverity] = useState(event?.severity ?? "");
  const [status, setStatus] = useState(event?.status ?? "draft");
  const [description, setDescription] = useState(event?.description ?? "");
  const [source, setSource] = useState(event?.source ?? "");
  const [thumbnail, setThumbnail] = useState(event?.thumbnail ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [shortTitle, setShortTitle] = useState(event?.short_title ?? "");
  const [monitoringFrom, setMonitoringFrom] = useState(event?.monitoring_from ?? event?.start_date ?? "");
  const [monitoringTo, setMonitoringTo] = useState(event?.monitoring_to ?? event?.end_date ?? "");
  const [methodology, setMethodology] = useState(event?.methodology ?? "");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t("admin.disaster.nameRequiredError"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const basePayload = {
        name: trimmedName,
        disaster_type: disasterType,
        location_name: locationName.trim(),
        province: textToList(province),
        district: textToList(district),
        event_date: eventDate || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        severity: severity || undefined,
        description: description.trim(),
        source: source.trim(),
        thumbnail: thumbnail.trim(),
        slug: slug.trim() || undefined,
        short_title: shortTitle.trim() || undefined,
        monitoring_from: monitoringFrom || undefined,
        monitoring_to: monitoringTo || undefined,
        methodology: methodology.trim() || undefined,
      };
      const saved = isEdit
        ? await updateDisasterEvent(event!.id, { ...basePayload, status })
        : await createDisasterEvent(basePayload);
      notify(isEdit ? t("admin.disaster.eventSaved") : t("admin.disaster.eventCreated"), "s");
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.disaster.saveEventFailed");
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{isEdit ? t("admin.disaster.eventInfo") : t("admin.disaster.newEvent")}</span>
      </div>
      <div className="card-body-custom">
        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.eventName")}</label>
            <input
              className="form-input"
              placeholder={t("admin.disaster.eventNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.disasterType")}</label>
            <select className="form-input" value={disasterType} onChange={(e) => setDisasterType(e.target.value)}>
              {disasterTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.placeName")}</label>
            <input
              className="form-input"
              placeholder={t("admin.disaster.placePlaceholder")}
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.severityLabel")}</label>
            <select className="form-input" value={severity ?? ""} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">{t("admin.disaster.unspecified")}</option>
              {severityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.provinces")}</label>
            <input
              className="form-input"
              placeholder={t("admin.disaster.provincesPlaceholder")}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.districts")}</label>
            <input
              className="form-input"
              placeholder={t("admin.disaster.districtsPlaceholder")}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
        </div>

        <div className="three-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.eventDate")}</label>
            <input className="form-input" type="date" value={eventDate ?? ""} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.startDate")}</label>
            <input className="form-input" type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.endDate")}</label>
            <input className="form-input" type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {disasterType === "forest_fire" && (
          <div className="card mb-3" style={{ background: "var(--surface-muted, rgba(13,139,97,.05))" }}>
            <div className="card-body-custom">
              <div className="form-field" style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">{t("admin.disaster.eventSlug")}</label>
                <input className="form-input" placeholder="kalimantan-2026" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
                <div className="two-col" style={{ marginBottom: "0.75rem" }}>
                <div className="form-field"><label className="form-label">{t("admin.disaster.shortTitle")}</label><input className="form-input" value={shortTitle} onChange={(e) => setShortTitle(e.target.value)} /></div>
                <div className="form-field"><label className="form-label">{t("admin.disaster.monitorStart")}</label><input className="form-input" type="date" value={monitoringFrom} onChange={(e) => setMonitoringFrom(e.target.value)} /></div>
              </div>
              <div className="two-col" style={{ marginBottom: "0.75rem" }}><div className="form-field"><label className="form-label">{t("admin.disaster.monitorEnd")}</label><input className="form-input" type="date" value={monitoringTo} onChange={(e) => setMonitoringTo(e.target.value)} /></div><div /></div>
              <div className="form-field"><label className="form-label">{t("admin.disaster.methodology")}</label><textarea className="form-input" rows={2} value={methodology} onChange={(e) => setMethodology(e.target.value)} /></div>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">{t("admin.disaster.status")}</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.source")}</label>
            <input
              className="form-input"
              placeholder={t("admin.disaster.sourcePlaceholder")}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.disaster.thumbnail")}</label>
            <input
              className="form-input"
              placeholder="https://..."
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">{t("admin.disaster.description")}</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder={t("admin.disaster.descriptionPlaceholder")}
            style={{ resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}

        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSubmit}>
            <i className="bi bi-save" /> {saving ? t("admin.disaster.saving") : t("admin.disaster.save")}
          </button>
          {onCancel && (
            <button type="button" className="btn-sm" onClick={onCancel}>
              {t("admin.disaster.cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
