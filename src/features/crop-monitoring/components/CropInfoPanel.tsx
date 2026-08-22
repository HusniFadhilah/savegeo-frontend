import { useState } from "react";
import { useFieldStore } from "@/hooks/useFieldStore";
import { updateField } from "../api";
import { ApiError } from "@/services/apiClient";
import type { Commodity, Field, UpdateFieldPayload } from "../types";

interface Props {
  commodities: Commodity[];
  field: Field | null;
}

/**
 * Commodity/variety/planting-date/season-label editor for the selected
 * Field. Disabled until a Field is selected/saved (FieldPanel). Each field
 * PATCHes /fields/{id} on blur/change - geometry is never touched here
 * (immutable after creation per the backend contract).
 */
export default function CropInfoPanel({ commodities, field }: Props) {
  const setSelectedField = useFieldStore((s) => s.selectField);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(partial: UpdateFieldPayload) {
    if (!field) return;
    setSaving(true);
    setError(null);
    try {
      await updateField(field.id, partial);
      await setSelectedField(field.id);
    } catch (err) {
      setError(err instanceof ApiError ? (err.payload as { detail?: string })?.detail ?? err.message : "Gagal memperbarui data lahan.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = !field;

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-clipboard-data me-1" /> Info Tanaman
        {saving && <span className="spinner-border spinner-border-sm ms-2" />}
      </div>
      <div className="card-body">
        {disabled && (
          <div className="alert alert-secondary py-2 small mb-0">
            Pilih atau simpan Lahan terlebih dahulu untuk mengisi info tanaman.
          </div>
        )}
        {field && (
          <>
            <div className="mb-2">
              <label className="form-label">Komoditas</label>
              <select
                className="form-select form-select-sm"
                value={field.commodity}
                onChange={(e) => void patch({ commodity: e.target.value })}
              >
                {commodities.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label">Varietas</label>
              <input
                type="text"
                className="form-control form-control-sm"
                defaultValue={field.variety ?? ""}
                placeholder="mis. Ciherang, IR64"
                onBlur={(e) => void patch({ variety: e.target.value || undefined })}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Tanggal Tanam</label>
              <input
                type="date"
                className="form-control form-control-sm"
                defaultValue={field.planting_date ?? ""}
                onChange={(e) => void patch({ planting_date: e.target.value || undefined })}
              />
            </div>
            <div className="mb-1">
              <label className="form-label">Label Musim</label>
              <input
                type="text"
                className="form-control form-control-sm"
                defaultValue={field.season_label ?? ""}
                placeholder="mis. MT1 2026"
                onBlur={(e) => void patch({ season_label: e.target.value || undefined })}
              />
            </div>
            {field.estimated_harvest_date && (
              <small className="text-muted d-block mt-2">
                <i className="bi bi-calendar-check me-1" /> Estimasi panen: <strong>{field.estimated_harvest_date}</strong>
              </small>
            )}
            {error && <div className="alert alert-danger py-1 px-2 mt-2 small mb-0">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
