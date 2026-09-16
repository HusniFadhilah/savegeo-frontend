import { useState } from "react";
import { createDisasterEvent, updateDisasterEvent } from "../../api";
import type { DisasterEvent } from "../../types";
import { useAdmin } from "../../AdminContext";

const DISASTER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "flood", label: "Banjir" },
  { value: "landslide", label: "Longsor" },
  { value: "forest_fire", label: "Kebakaran Hutan" },
  { value: "earthquake", label: "Gempa Bumi" },
  { value: "tsunami", label: "Tsunami" },
  { value: "volcanic_eruption", label: "Erupsi Gunung Api" },
  { value: "storm", label: "Badai" },
  { value: "drought", label: "Kekeringan" },
  { value: "other", label: "Lainnya" },
];

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: "low", label: "Rendah" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi" },
  { value: "critical", label: "Kritis" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Diproses" },
  { value: "ready_for_review", label: "Siap Ditinjau" },
  { value: "published", label: "Dipublikasikan" },
  { value: "archived", label: "Diarsipkan" },
];

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
  const { notify } = useAdmin();
  const isEdit = Boolean(event);

  const [name, setName] = useState(event?.name ?? "");
  const [disasterType, setDisasterType] = useState(event?.disaster_type ?? DISASTER_TYPE_OPTIONS[0].value);
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
      setFormError("Nama kejadian diperlukan");
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
      notify(isEdit ? "Kejadian bencana diperbarui" : "Kejadian bencana dibuat", "s");
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan kejadian bencana";
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{isEdit ? "Informasi Kejadian" : "Kejadian Bencana Baru"}</span>
      </div>
      <div className="card-body-custom">
        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">Nama Kejadian *</label>
            <input
              className="form-input"
              placeholder="cth: Banjir Bandang Kalimantan Selatan Jan 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Jenis Bencana *</label>
            <select className="form-input" value={disasterType} onChange={(e) => setDisasterType(e.target.value)}>
              {DISASTER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">Nama Lokasi</label>
            <input
              className="form-input"
              placeholder="cth: Kabupaten Banjar"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Tingkat Keparahan</label>
            <select className="form-input" value={severity ?? ""} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Tidak ditentukan</option>
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">Provinsi (pisahkan koma)</label>
            <input
              className="form-input"
              placeholder="cth: Kalimantan Selatan"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Kabupaten/Kota (pisahkan koma)</label>
            <input
              className="form-input"
              placeholder="cth: Banjar, Tanah Laut"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
        </div>

        <div className="three-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">Tanggal Kejadian</label>
            <input className="form-input" type="date" value={eventDate ?? ""} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Tanggal Mulai</label>
            <input className="form-input" type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Tanggal Selesai</label>
            <input className="form-input" type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {disasterType === "forest_fire" && (
          <div className="card mb-3" style={{ background: "var(--surface-muted, rgba(13,139,97,.05))" }}>
            <div className="card-body-custom">
              <div className="form-field" style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Slug event (URL)</label>
                <input className="form-input" placeholder="kalimantan-2026" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div className="two-col" style={{ marginBottom: "0.75rem" }}>
                <div className="form-field"><label className="form-label">Judul singkat</label><input className="form-input" value={shortTitle} onChange={(e) => setShortTitle(e.target.value)} /></div>
                <div className="form-field"><label className="form-label">Mulai pemantauan</label><input className="form-input" type="date" value={monitoringFrom} onChange={(e) => setMonitoringFrom(e.target.value)} /></div>
              </div>
              <div className="two-col" style={{ marginBottom: "0.75rem" }}><div className="form-field"><label className="form-label">Selesai pemantauan</label><input className="form-input" type="date" value={monitoringTo} onChange={(e) => setMonitoringTo(e.target.value)} /></div><div /></div>
              <div className="form-field"><label className="form-label">Metodologi / catatan data</label><textarea className="form-input" rows={2} value={methodology} onChange={(e) => setMethodology(e.target.value)} /></div>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="two-col" style={{ marginBottom: "0.75rem" }}>
          <div className="form-field">
            <label className="form-label">Sumber</label>
            <input
              className="form-input"
              placeholder="cth: BNPB, BMKG"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">URL Thumbnail</label>
            <input
              className="form-input"
              placeholder="https://..."
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label">Deskripsi</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Ringkasan kejadian bencana (opsional)"
            style={{ resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}

        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSubmit}>
            <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
          {onCancel && (
            <button type="button" className="btn-sm" onClick={onCancel}>
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
