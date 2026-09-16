import { useEffect } from "react";
import AoiPickerContent from "@/components/map/AoiPickerContent";
import type { AoiState } from "@/features/carbon/types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  open: boolean;
  id: string;
  title: string;
  description?: string;
  aoi: AoiState | null;
  onAoiChange: (aoi: AoiState | null) => void;
  onClose: () => void;
}

export default function AoiPickerModal({ open, id, title, description, aoi, onAoiChange, onClose }: Props) {
  const t = useI18nStore((state) => state.t);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="aoi-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}Title`}>
      <div className="aoi-modal-backdrop" onClick={onClose} />
      <div className="aoi-modal-dialog">
        <div className="aoi-modal-header">
          <div>
            <span className="aoi-modal-eyebrow">{t("aoi.eyebrow")}</span>
            <h2 id={`${id}Title`}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="aoi-modal-close" onClick={onClose} aria-label={t("aoi.close")}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="aoi-modal-body">
          <AoiPickerContent id={id} aoi={aoi} onAoiChange={onAoiChange} />
        </div>

        <div className="aoi-modal-footer">
          <div className={`aoi-modal-status ${aoi ? "ready" : ""}`}>
            <i className={`bi ${aoi ? "bi-check-circle-fill" : "bi-info-circle"}`} />
            <span>{aoi ? `${t("aoi.active")}: ${aoi.name}` : t("aoi.statusHint")}</span>
          </div>
          <div className="aoi-modal-actions">
            {aoi && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onAoiChange(null)}>
                <i className="bi bi-eraser" /> {t("aoi.remove")}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              <i className="bi bi-check2" /> {t("aoi.done")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
