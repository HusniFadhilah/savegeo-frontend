import { useI18nStore } from "@/hooks/useI18nStore";
import type { CarbonPoolKey, CarbonPoolResults } from "@/features/carbon/types";
import CarbonStatsPanel from "./CarbonStatsPanel";

interface Props {
  results: CarbonPoolResults;
}

const POOLS: { key: CarbonPoolKey; icon: string; labelKey: string }[] = [
  { key: "agb", icon: "bi-tree", labelKey: "carbon.basic.agb" },
  { key: "bgb", icon: "bi-bezier2", labelKey: "carbon.basic.bgb" },
  { key: "soc", icon: "bi-layers", labelKey: "carbon.basic.soc" },
];

export default function CarbonPoolsSummary({ results }: Props) {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const locale = language === "id" ? "id-ID" : "en-US";
  const available = POOLS.filter(({ key }) => results[key]);

  return (
    <section className="carbon-basic-results" aria-labelledby="carbonBasicResultsTitle">
      <div className="carbon-basic-results__header">
        <h5 id="carbonBasicResultsTitle" className="carbon-basic-results__title">
          {t("carbon.basic.resultsTitle")}
        </h5>
        <p className="carbon-basic-results__note">{t("carbon.basic.sourceNote")}</p>
      </div>
      {available.length > 0 ? <div className="carbon-basic-results__list">
        {available.map(({ key, icon, labelKey }) => {
          const result = results[key];
          if (!result) return null;
          const unit = result.carbon_estimated.unit || "Mg C/ha";
          const mean = result.carbon_estimated.statistics?.mean;
          const total = result.area_info?.total_carbon_tons;
          const reference = result.carbon_reference?.name || result.carbon_reference?.full_name
            || result.model_info?.reference_dataset || "";
          const period = result.model_info?.analysis_year || result.model_info?.source_period
            || result.model_info?.reference_dataset_year;
          const referenceYear = result.model_info?.reference_dataset_year
            || result.model_info?.reference_year || result.carbon_reference?.year;
          const currentYearPartial = Boolean(result.model_info?.analysis_year_partial);
          const staticReferenceOnly = result.model_info?.analysis_year_mode === "static_reference"
            && result.model_info?.requested_analysis_year != null
            && String(result.model_info.requested_analysis_year) !== String(result.model_info.analysis_year);

          return (
            <div className="col-12" key={key}>
              <article className="carbon-basic-pool-card">
                <div className="carbon-basic-pool-card__heading">
                  <span className="carbon-basic-pool-card__icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
                  <div>
                    <h6 className="mb-0">{t(labelKey)}</h6>
                    <small className="carbon-basic-pool-card__source">{reference}</small>
                    <div className="carbon-basic-pool-card__meta">
                      {period && (
                        <span>
                          <i className="bi bi-calendar3" aria-hidden="true" />
                          {language === "id" ? "Estimasi" : "Estimate"} {period}
                        </span>
                      )}
                      {referenceYear != null && (
                        <span>
                          <i className="bi bi-database" aria-hidden="true" />
                          {language === "id" ? "Referensi" : "Reference"} {referenceYear}
                        </span>
                      )}
                      {currentYearPartial && (
                        <span className="carbon-basic-pool-card__badge carbon-basic-pool-card__badge--current">
                          <i className="bi bi-clock-history" aria-hidden="true" />
                          {language === "id" ? "Data terbaru tahun berjalan" : "Latest data this year"}
                        </span>
                      )}
                      {staticReferenceOnly && (
                        <span className="carbon-basic-pool-card__badge carbon-basic-pool-card__badge--reference">
                          <i className="bi bi-info-circle" aria-hidden="true" />
                          {language === "id" ? `Referensi statis ${result.model_info?.analysis_year}` : `Static reference ${result.model_info?.analysis_year}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="carbon-basic-pool-card__metrics">
                  <div>
                    <span>{t("carbon.basic.meanDensity")}</span>
                    <strong>{mean == null ? "—" : `${Number(mean).toLocaleString(locale, { maximumFractionDigits: 2 })} ${unit}`}</strong>
                  </div>
                  <div>
                    <span>{t("carbon.basic.totalStock")}</span>
                    <strong>{total == null ? "—" : `${Number(total).toLocaleString(locale, { maximumFractionDigits: 2 })} Mg C`}</strong>
                  </div>
                </div>
                <details className="carbon-basic-pool-card__details">
                  <summary>{t("carbon.basic.details")}</summary>
                  <CarbonStatsPanel result={result} />
                </details>
              </article>
            </div>
          );
        })}
      </div> : <div className="alert alert-warning carbon-basic-results__empty" role="status">{t("carbon.basic.noResults")}</div>}
    </section>
  );
}
