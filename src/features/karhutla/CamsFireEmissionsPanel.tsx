import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { fetchWildfireCamsCapabilities } from "@/features/disaster/api";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { WildfireCamsCapabilities, WildfireCamsProduct } from "./types";

const CamsArchiveMap = lazy(() => import("./CamsArchiveMap"));

type Props = {
  slug: string;
  eventConfirmed: boolean;
  onSelectionChange?: (layerId: "burnt_carbon" | "organic_aod", frameId: string, opacity: number) => void;
};

function statusTranslationKey(status: WildfireCamsCapabilities["status"]): string {
  switch (status) {
    case "ready":
      return "wildfire.cams.status.ready";
    case "needs_credentials":
      return "wildfire.cams.status.needsCredentials";
    case "needs_terms_acceptance":
      return "wildfire.cams.status.needsTerms";
    case "invalid_configuration":
      return "wildfire.cams.status.invalidConfiguration";
    default:
      return "wildfire.cams.status.validationBlocked";
  }
}

function ProductCard({ product, t, available = false }: { product: WildfireCamsProduct; t: (key: string) => string; available?: boolean }) {
  const isGfas = product.id === "gfas";
  const versionText = (product.products ?? [])
    .map((item) => `${item.version} (${item.coverage_start} – ${item.coverage_end ?? t("wildfire.cams.present")})`)
    .join("; ");
  return (
    <article className="wildfire-cams-product">
      <div className="wildfire-cams-product__heading">
        <span className="wildfire-cams-product__icon" aria-hidden="true">
          <i className={`bi ${isGfas ? "bi-fire" : "bi-wind"}`} />
        </span>
        <div>
          <h3>{isGfas ? t("wildfire.cams.gfas.title") : t("wildfire.cams.ifs.title")}</h3>
          <p>{isGfas ? t("wildfire.cams.gfas.summary") : t("wildfire.cams.ifs.summary")}</p>
        </div>
      </div>
      <dl className="wildfire-cams-metadata">
        {isGfas ? (
          <>
            <div><dt>{t("wildfire.cams.version")}</dt><dd>{versionText}</dd></div>
            <div><dt>{t("wildfire.cams.temporal")}</dt><dd>{t("wildfire.cams.gfas.temporal")}</dd></div>
          </>
        ) : (
          <>
            <div><dt>{t("wildfire.cams.forecast")}</dt><dd>{t("wildfire.cams.ifs.forecast")}</dd></div>
            <div><dt>{t("wildfire.cams.temporal")}</dt><dd>{t("wildfire.cams.ifs.temporal")}</dd></div>
          </>
        )}
        <div><dt>{t("wildfire.cams.resolution")}</dt><dd>{product.resolution_degrees}°</dd></div>
        <div><dt>{t("wildfire.cams.variables")}</dt><dd>{t("wildfire.cams.catalogListed")}</dd></div>
      </dl>
      <ul className="wildfire-cams-variable-list" aria-label={t("wildfire.cams.variables")}>
        {Object.values(product.variables).map((item) => (
          <li key={item.source_name}>
            <strong>{item.symbol}</strong><span>{item.label}</span>
            <code>{item.unit}{item.temporal_resolution_hours ? ` · ${item.temporal_resolution_hours} h` : ""}</code>
            {item.vertical_product && <small>{item.vertical_product}</small>}
          </li>
        ))}
      </ul>
      <p className="wildfire-cams-product__note">
        {isGfas ? t("wildfire.cams.gfas.note") : t("wildfire.cams.ifs.note")}
      </p>
      {!available && <button className="wildfire-cams-unavailable" type="button" disabled>
        <i className="bi bi-lock" aria-hidden="true" /> {t("wildfire.cams.visualizationUnavailable")}
      </button>}
      <a href={product.source_url} target="_blank" rel="noreferrer">
        {t("wildfire.cams.openCatalog")} <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
      </a>
      <small>{product.provider} · {product.license} · DOI {product.doi}</small>
    </article>
  );
}

export default function CamsFireEmissionsPanel({ slug, eventConfirmed, onSelectionChange }: Props) {
  const { t } = useI18nStore();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [capabilities, setCapabilities] = useState<WildfireCamsCapabilities | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestRef = useRef<{
    slug: string;
    promise: Promise<{ ok: true; value: WildfireCamsCapabilities } | { ok: false }>;
  } | null>(null);

  useEffect(() => {
    if (!expanded || !eventConfirmed || (loadedSlug === slug && capabilities)) return undefined;
    let cancelled = false;
    if (!requestRef.current || requestRef.current.slug !== slug) {
      const request = fetchWildfireCamsCapabilities(slug).then(
        (value) => ({ ok: true as const, value }),
        () => ({ ok: false as const }),
      );
      requestRef.current = { slug, promise: request };
    }
    const requestPromise = requestRef.current.promise;
    setLoading(true);
    setError(false);
    setCapabilities(null);
    requestPromise
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(true);
          return;
        }
        setCapabilities(result.value);
        setLoadedSlug(slug);
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [capabilities, eventConfirmed, expanded, loadedSlug, retryCount, slug]);

  const retry = () => {
    requestRef.current = null;
    setError(false);
    setLoadedSlug(null);
    setRetryCount((count) => count + 1);
  };

  return (
    <section className="wildfire-cams-panel" aria-label={t("wildfire.cams.title")}>
      <details
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>
          <span className="wildfire-cams-summary__icon" aria-hidden="true"><i className="bi bi-cloud-haze2" /></span>
          <span className="wildfire-cams-summary__copy">
            <strong>{t("wildfire.cams.title")}</strong>
            <small>{t("wildfire.cams.subtitle")}</small>
          </span>
          <span className="wildfire-cams-summary__tag">CAMS</span>
          <i className="bi bi-chevron-down wildfire-cams-summary__chevron" aria-hidden="true" />
        </summary>
        <div className="wildfire-cams-panel__body">
          {!eventConfirmed ? (
            <div className="wildfire-cams-status" role="status">
              <i className="bi bi-hourglass-split" aria-hidden="true" /> {t("wildfire.cams.eventUnconfirmed")}
            </div>
          ) : loading ? (
            <div className="wildfire-cams-status" role="status" aria-live="polite">
              <span className="wildfire-loading-spinner" aria-hidden="true" /> {t("wildfire.cams.loading")}
            </div>
          ) : error ? (
            <div className="wildfire-cams-status wildfire-cams-status--error" role="alert">
              <span>{t("wildfire.cams.error")}</span>
              <button type="button" onClick={retry}>{t("wildfire.cams.retry")}</button>
            </div>
          ) : capabilities ? (
            <>
              <div className="wildfire-cams-status" role="status">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>{t(statusTranslationKey(capabilities.status))}</span>
              </div>
              {capabilities.data_available ? <>
                {expanded && <Suspense fallback={<p role="status">{t("wildfire.cams.loading")}</p>}><CamsArchiveMap slug={slug} onSelectionChange={onSelectionChange} /></Suspense>}
                <details><summary>{t("wildfire.cams.methodology")}</summary>
                  <div className="wildfire-cams-product-grid">{capabilities.products.map((product) => <ProductCard key={product.id} product={product} t={t} available />)}</div>
                </details>
              </> : <>
                <p className="wildfire-cams-disclaimer">{t("wildfire.cams.disclaimer")}</p>
                <div className="wildfire-cams-product-grid">{capabilities.products.map((product) => <ProductCard key={product.id} product={product} t={t} />)}</div>
              </>}
              <p className="wildfire-cams-attribution">{capabilities.attribution}. {capabilities.disclaimer}</p>
            </>
          ) : (
            <div className="wildfire-cams-status" role="status">{t("wildfire.cams.notLoaded")}</div>
          )}
        </div>
      </details>
    </section>
  );
}
