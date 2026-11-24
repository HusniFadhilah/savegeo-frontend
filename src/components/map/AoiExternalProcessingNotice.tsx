import { useI18nStore } from "@/hooks/useI18nStore";

/** Explain which location information may be shared with external map and analysis providers. */
export default function AoiExternalProcessingNotice() {
  const t = useI18nStore((state) => state.t);
  return (
    <div className="alert alert-info small py-2 mb-3" role="note">
      <i className="bi bi-info-circle me-1" aria-hidden="true" />
      {t("aoi.externalProcessingNotice")}
    </div>
  );
}