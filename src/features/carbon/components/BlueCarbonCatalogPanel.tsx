import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import CropPanelAccordion from "@/features/crop-monitoring/components/CropPanelAccordion";
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
  citation: string;
  notes: string;
  values: Record<string, number | null | undefined>;
};

const POOLS: Record<string, string> = { agb: "AGB", bgb: "BGB", soc: "SOC sedimen", litter: "Serasah", deadwood: "Kayu mati" };
const fmt = (value?: number | null) => value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export default function BlueCarbonCatalogPanel() {
  const [profiles, setProfiles] = useState<BlueCarbonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.get<{ profiles: BlueCarbonProfile[] }>("/carbon/extensions/blue-carbon/catalog", { auth: "app" })
      .then((data) => { if (active) setProfiles(data.profiles); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Katalog blue carbon belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section className="blue-carbon-catalog" aria-label="Katalog data blue carbon">
      <div className="blue-carbon-catalog__intro">
        <span className="blue-carbon-catalog__icon"><i className="bi bi-water" aria-hidden="true" /></span>
        <div>
          <span className="blue-carbon-catalog__eyebrow">DATA PESISIR</span>
          <h2>Blue carbon</h2>
          <p>Dataset dan pengukuran ekosistem pesisir yang telah dipublikasikan admin. Angka ditampilkan mengikuti unit dan cakupan sumber aslinya.</p>
        </div>
      </div>
      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {loading ? <div className="blue-carbon-catalog__empty"><span className="spinner-border spinner-border-sm" /> Memuat katalog…</div> : profiles.length === 0 ? (
        <div className="blue-carbon-catalog__empty"><i className="bi bi-database-exclamation" /><strong>Belum ada dataset yang dipublikasikan</strong><span>Katalog akan menampilkan sumber dan pengukuran setelah ditambahkan melalui menu admin.</span></div>
      ) : (
        <div className="blue-carbon-catalog__grid">
          {profiles.map((profile) => (
            <article className="blue-carbon-catalog__card" key={profile.id}>
              <div className="blue-carbon-catalog__card-head">
                <span className="blue-carbon-catalog__habitat"><i className="bi bi-tree" /> {profile.habitat}</span>
                <span className="blue-carbon-catalog__kind">{profile.data_kind === "field_observation" ? "Lapangan" : profile.data_kind === "literature" ? "Literatur" : "Dataset"}</span>
              </div>
              <h3>{profile.name}</h3>
              <div className="blue-carbon-catalog__meta">
                {profile.region && <span><i className="bi bi-geo-alt" /> {profile.region}</span>}
                {profile.period && <span><i className="bi bi-calendar3" /> {profile.period}</span>}
                {profile.resolution_m != null && <span><i className="bi bi-grid-3x3" /> {fmt(profile.resolution_m)} m</span>}
              </div>
              <div className="blue-carbon-catalog__pools">
                {Object.entries(POOLS).map(([key, label]) => profile.values?.[key] != null && (
                  <div key={key}><small>{label}</small><strong>{fmt(profile.values[key])} <span>Mg C/ha</span></strong></div>
                ))}
                {!Object.values(profile.values ?? {}).some((value) => value != null) && <span className="text-muted small">Metadata dataset; nilai stok tidak dicantumkan sumber.</span>}
              </div>
              {profile.notes && <p className="blue-carbon-catalog__notes">{profile.notes}</p>}
              <CropPanelAccordion title="Sumber dan metode" icon="bi-journal-text" className="blue-carbon-catalog__source">
                <strong>{profile.source_name}</strong>
                {profile.citation && <p className="small mb-2">{profile.citation}</p>}
                {profile.source_url && <a href={profile.source_url} target="_blank" rel="noreferrer">Buka sumber <i className="bi bi-box-arrow-up-right" /></a>}
              </CropPanelAccordion>
            </article>
          ))}
        </div>
      )}
      <p className="blue-carbon-catalog__disclaimer"><i className="bi bi-info-circle" /> Nilai dari sumber yang berbeda dapat memakai definisi, kedalaman sedimen, dan metode yang berbeda; bandingkan setelah memeriksa metadata sumber.</p>
    </section>
  );
}
