import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import CropPanelAccordion from "@/features/crop-monitoring/components/CropPanelAccordion";
import { safeHttpUrl } from "@/utils/safeHttpUrl";
import "./blue-carbon-catalog.css";

type BlueCarbonProfile = {
  id: string;
  name: string;
  habitat: string;
  data_kind: string;
  region: string;
  period: string;
  resolution_m: number | null;
  source_name: string;
  source_url: string;
  viewer_url?: string;
  citation: string;
  license?: string;
  coverage_note?: string;
  notes: string;
  is_curated?: boolean;
  values: Record<string, number | null | undefined>;
};

const POOLS: Record<string, [string, string]> = { agb: ["AGB", "AGB"], bgb: ["BGB", "BGB"], soc: ["SOC sedimen", "Sediment SOC"], litter: ["Serasah", "Litter"], deadwood: ["Kayu mati", "Deadwood"] };
const SOURCE_KIND: Record<string, [string, string]> = {
  field_observation: ["Pengukuran lapangan", "Field measurement"],
  literature: ["Literatur", "Literature"],
  modelled_raster: ["Raster model", "Modelled raster"],
  open_raster: ["Raster terbuka", "Open raster"],
  open_dataset: ["Dataset terbuka", "Open dataset"],
  dataset: ["Dataset", "Dataset"],
};
const fmt = (value?: number | null) => value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export default function BlueCarbonCatalogPanel() {
  const c = useBilingualCopy();
  const [profiles, setProfiles] = useState<BlueCarbonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.get<{ profiles: BlueCarbonProfile[] }>("/carbon/extensions/blue-carbon/catalog", { auth: "app" })
      .then((data) => { if (active) setProfiles(data.profiles); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : c("Katalog blue carbon belum dapat dimuat.", "The blue carbon catalogue could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section className="blue-carbon-catalog" aria-label={c("Katalog data blue carbon", "Blue carbon data catalogue")}>
      <div className="blue-carbon-catalog__intro">
        <span className="blue-carbon-catalog__icon"><i className="bi bi-water" aria-hidden="true" /></span>
        <div>
          <span className="blue-carbon-catalog__eyebrow">{c("DATA PESISIR", "COASTAL DATA")}</span>
          <h2>{c("Karbon biru (blue carbon)", "Blue carbon")}</h2>
          <p>{c("Sumber data terbuka dan pengukuran ekosistem pesisir. Raster, prediksi, dan titik lapangan ditandai sesuai cakupan serta metode sumber aslinya.", "Open datasets and coastal ecosystem measurements. Rasters, predictions, and field points are labelled according to their original coverage and methods.")}</p>
        </div>
      </div>
      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {loading ? <div className="blue-carbon-catalog__empty"><span className="spinner-border spinner-border-sm" /> {c("Memuat katalog…", "Loading catalogue…")}</div> : profiles.length === 0 ? (
        <div className="blue-carbon-catalog__empty"><i className="bi bi-database-exclamation" /><strong>{c("Belum ada dataset yang dipublikasikan", "No datasets have been published")}</strong><span>{c("Katalog akan menampilkan sumber dan pengukuran setelah ditambahkan melalui menu admin.", "Sources and measurements will appear here after they are added through the admin menu.")}</span></div>
      ) : (
        <div className="blue-carbon-catalog__grid">
          {profiles.map((profile) => (
            <article className="blue-carbon-catalog__card" key={profile.id}>
              <div className="blue-carbon-catalog__card-head">
                <span className="blue-carbon-catalog__habitat"><i className="bi bi-tree" /> {profile.habitat}</span>
                <span className="blue-carbon-catalog__kind">{profile.is_curated ? c("Sumber terbuka", "Open source") : c((SOURCE_KIND[profile.data_kind] ?? ["Dataset", "Dataset"] as [string, string])[0], (SOURCE_KIND[profile.data_kind] ?? ["Dataset", "Dataset"] as [string, string])[1])}</span>
              </div>
              <h3>{profile.name}</h3>
              <div className="blue-carbon-catalog__meta">
                {profile.region && <span><i className="bi bi-geo-alt" /> {profile.region}</span>}
                {profile.period && <span><i className="bi bi-calendar3" /> {profile.period}</span>}
                {profile.resolution_m != null && <span><i className="bi bi-grid-3x3" /> {fmt(profile.resolution_m)} m</span>}
              </div>
              <div className="blue-carbon-catalog__pools">
                {Object.entries(POOLS).map(([key, label]) => profile.values?.[key] != null && (
                  <div key={key}><small>{c(...label)}</small><strong>{fmt(profile.values[key])} <span>Mg C/ha</span></strong></div>
                ))}
                {!Object.values(profile.values ?? {}).some((value) => value != null) && (
                  <span className="text-muted small">
                    {profile.data_kind === "field_observation"
                      ? c("Nilai tersimpan per lokasi/plot pada file sumber.", "Values are stored by location/plot in the source file.")
                      : c("Data raster/titik; tidak diringkas menjadi satu nilai nasional.", "Raster/point data; not summarized as a single national value.")}
                  </span>
                )}
              </div>
              {profile.coverage_note && <p className="blue-carbon-catalog__coverage"><i className="bi bi-geo-alt" aria-hidden="true" /> {profile.coverage_note}</p>}
              {profile.notes && <p className="blue-carbon-catalog__notes">{profile.notes}</p>}
              <CropPanelAccordion title={c("Sumber dan metode", "Source and method")} icon="bi-journal-text" className="blue-carbon-catalog__source">
                <strong>{profile.source_name}</strong>
                {profile.citation && <p className="small mb-2">{profile.citation}</p>}
                {profile.license && <small><strong>{c("Lisensi:", "License:")}</strong> {profile.license}</small>}
                <div className="blue-carbon-catalog__links">
                  {safeHttpUrl(profile.source_url) && <a href={safeHttpUrl(profile.source_url)} target="_blank" rel="noopener noreferrer">{c("Dataset / arsip", "Dataset / archive")} <i className="bi bi-box-arrow-up-right" /></a>}
                  {safeHttpUrl(profile.viewer_url) && <a href={safeHttpUrl(profile.viewer_url)} target="_blank" rel="noopener noreferrer">{c("Peta interaktif", "Interactive map")} <i className="bi bi-box-arrow-up-right" /></a>}
                </div>
              </CropPanelAccordion>
            </article>
          ))}
        </div>
      )}
      <p className="blue-carbon-catalog__disclaimer"><i className="bi bi-info-circle" /> {c("Katalog ini memuat data raster dan sampel nyata dari sumber terbuka. Peta cakupan tidak sama dengan peta karbon; prediksi global bukan pengukuran lapangan. Untuk Indonesia, periksa catatan cakupan dan kesesuaian mask sebelum membandingkan nilai.", "This catalogue includes raster data and real samples from open sources. An extent map is not a carbon map, and global predictions are not field measurements. For Indonesia, check coverage notes and mask applicability before comparing values.")}</p>
    </section>
  );
}
