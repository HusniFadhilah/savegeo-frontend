import { Link } from "react-router-dom";
import { useI18nStore } from "@/hooks/useI18nStore";

export interface DmrvBreadcrumbItem {
  label: string;
  to?: string;
}

export interface DmrvHeaderMetric {
  icon: string;
  label: string;
  value: string;
}

interface DmrvPageHeaderProps {
  breadcrumbs: DmrvBreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string;
  metrics?: DmrvHeaderMetric[];
}

export default function DmrvPageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  metrics = [],
}: DmrvPageHeaderProps) {
  const t = useI18nStore((state) => state.t);

  return (
    <header className="dmrv-page-header">
      <nav aria-label={t("dmrv.breadcrumb.label")}>
        <ol className="breadcrumb dmrv-breadcrumb">
          {breadcrumbs.map((item, index) => {
            const current = index === breadcrumbs.length - 1;
            return (
              <li
                className={`breadcrumb-item${current ? " active" : ""}`}
                key={`${index}-${item.label}`}
              >
                {!current && item.to ? (
                  <Link to={item.to}>{item.label}</Link>
                ) : (
                  <span aria-current={current ? "page" : undefined}>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="analysis-hero analysis-hero-dmrv" aria-labelledby="dmrv-page-title">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">
            <i className="bi bi-shield-check" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1 id="dmrv-page-title">{title}</h1>
          <p>{description}</p>
        </div>
        {metrics.length > 0 ? (
          <div className="analysis-hero-status" aria-label={t("dmrv.header.summary")}>
            {metrics.map((metric) => (
              <div className="analysis-status-card" key={metric.label}>
                <i className={`bi ${metric.icon}`} aria-hidden="true" />
                <div>
                  <span>{metric.label}</span>
                  <strong title={metric.value}>{metric.value}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </header>
  );
}
