import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { DisasterCompleteness } from "../types";

const statusIcons = {
  available: "bi-check-circle-fill",
  not_computed: "bi-clock-history",
  requires_model_data: "bi-database-exclamation",
};

export default function AnalysisCompleteness({ report }: { report: DisasterCompleteness }) {
  const { language } = useI18nStore();
  const indonesian = language === "id";
  const statusLabels = indonesian
    ? { available: "Tersedia", not_computed: "Belum dihitung", requires_model_data: "Perlu data" }
    : { available: "Available", not_computed: "Not computed", requires_model_data: "Needs data" };

  return <details className="disaster-completeness">
    <summary>
      <span className="disaster-completeness__title"><i className="bi bi-list-check" aria-hidden="true" />{indonesian ? "Kelengkapan analisis" : "Analysis coverage"}</span>
      <span className="disaster-completeness__count">{report.available_count}/{report.required_count} {indonesian ? "tersedia" : "available"}</span>
    </summary>
    <div className="disaster-completeness__body">
      <div className="disaster-completeness__note">
        <i className="bi bi-info-circle" aria-hidden="true" />
        <span>{indonesian ? "Kriteria dan batas interpretasi" : "Criteria and interpretation limits"}</span>
        <InfoTip label={indonesian ? "Tentang kelengkapan analisis" : "About analysis coverage"} content={report.note} />
      </div>
      <div className="table-responsive">
        <table className="table table-sm mb-0" aria-label={indonesian ? "Status kelengkapan analisis" : "Analysis coverage status"}>
          <thead><tr><th>{indonesian ? "Analisis" : "Analysis"}</th><th>{indonesian ? "Status" : "Status"}</th><th>{indonesian ? "Detail" : "Details"}</th></tr></thead>
          <tbody>{report.sections.map(section => {
            const detail = section.requirements.join(" ") || section.interpretation;
            return <tr key={section.id}>
              <td>{section.label}</td>
              <td><span className={`disaster-completeness__status is-${section.status}`}><i className={`bi ${statusIcons[section.status]}`} aria-hidden="true" />{statusLabels[section.status]}</span></td>
              <td>{detail
                ? <InfoTip label={indonesian ? `Detail ${section.label}` : `${section.label} details`} content={detail} />
                : <span className="text-muted">—</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  </details>;
}