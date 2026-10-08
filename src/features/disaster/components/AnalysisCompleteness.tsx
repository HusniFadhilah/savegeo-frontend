import type { DisasterCompleteness } from "../types";

const statusLabels = { available: "Hasil tersedia", not_computed: "Belum dihitung", requires_model_data: "Perlu model / data" };

export default function AnalysisCompleteness({ report }: { report: DisasterCompleteness }) {
  return <section className="card mb-3 disaster-modern-card" aria-label="Kelengkapan analisis event">
    <div className="card-header disaster-soft-header">Kelengkapan analisis · {report.available_count}/{report.required_count}</div>
    <div className="card-body">
      <p className="small">{report.note}</p>
      <div className="table-responsive"><table className="table table-sm mb-0">
        <thead><tr><th>Analisis</th><th>Status</th><th>Interpretasi / kebutuhan</th></tr></thead>
        <tbody>{report.sections.map(section => <tr key={section.id}>
          <td>{section.label}</td><td><span className={`badge ${section.status === "available" ? "bg-success" : "bg-secondary"}`}>{statusLabels[section.status]}</span></td>
          <td className="small">{section.requirements.join(" ") || section.interpretation}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </section>;
}
