import { useState } from "react";
import type { WildfireQueryState } from "./queryState";

type LayerTab = "hotspot" | "overlays" | "fdrs";

interface Props {
  query: WildfireQueryState;
  onToggleLayer: (layer: string) => void;
  viirsAvailable: boolean | null;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
}

interface LayerOption {
  id: string;
  label: string;
  description?: string;
  available: boolean;
}

const overlayOptions: LayerOption[] = [
  { id: "boundary", label: "Batas provinsi", available: true },
  { id: "clouds", label: "Observasi tutupan awan (H-1)", description: "Feed satelit belum terhubung", available: false },
  { id: "wind", label: "Pergerakan angin", description: "Open-Meteo", available: true },
  { id: "air-quality", label: "Kualitas udara", description: "Feed kualitas udara belum terhubung", available: false },
  { id: "rain", label: "Potensi hujan", description: "Feed prakiraan belum terhubung", available: false },
  { id: "units", label: "Unit kerja", description: "Data operasional belum terhubung", available: false },
  { id: "suppression", label: "Pemadaman kebakaran", description: "Data operasional belum terhubung", available: false },
  { id: "groundcheck", label: "Groundcheck hotspot", description: "Feed verifikasi belum terhubung", available: false },
  { id: "peat-water", label: "TMAT gambut", description: "Feed belum terhubung", available: false },
];

const fdrsOptions = [
  "Fine Fuel Moisture Code",
  "Duff Moisture Code",
  "Drought Code",
  "Build Up Index",
  "Initial Spread Index",
  "Fire Weather Index",
];

function LayerCheckbox({ option, checked, onChange }: { option: LayerOption; checked: boolean; onChange: () => void }) {
  return (
    <label className={`wildfire-layer-option ${option.available ? "" : "is-disabled"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!option.available}
        onChange={onChange}
        aria-label={option.label}
      />
      <span className="wildfire-layer-option-copy">
        <span>{option.label}</span>
        {option.description && <small>{option.description}</small>}
      </span>
      {!option.available && <span className="wildfire-layer-status">Segera</span>}
    </label>
  );
}

export default function WildfireLayerPanel({ query, onToggleLayer, viirsAvailable, onSync, syncing, syncError }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LayerTab>("overlays");
  const viirsOption: LayerOption = {
    id: "viirs",
    label: "VIIRS / NASA FIRMS",
    description: viirsAvailable === false ? "Tidak ada data pada periode ini" : "Data hotspot tersimpan",
    available: true,
  };

  return (
    <div className="leaflet-top leaflet-right wildfire-layer-control">
      <button type="button" className={`wildfire-layer-trigger leaflet-control ${open ? "is-active" : ""}`} title="Tampilkan layer" aria-label="Tampilkan layer" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i className="bi bi-layers" aria-hidden="true" />
      </button>
      {open && <div className="wildfire-layer-panel leaflet-control" role="dialog" aria-label="Layer karhutla">
        <div className="wildfire-layer-heading"><div><i className="bi bi-layers" aria-hidden="true" /><strong>Layer</strong></div><button type="button" className="wildfire-layer-close" aria-label="Tutup layer" onClick={() => setOpen(false)}><i className="bi bi-x-lg" /></button></div>
        <div className="wildfire-layer-tabs" role="tablist" aria-label="Jenis layer">
          {([[
            "hotspot", "Hotspot",
          ], ["overlays", "Overlays"], ["fdrs", "FDRS"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "is-active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "hotspot" && (
          <div className="wildfire-layer-list" role="tabpanel">
            <LayerCheckbox option={{ id: "hotspot", label: "Hotspot tersimpan", description: "NASA FIRMS - titik tersimpan di database", available: true }} checked={query.layers.includes("hotspot")} onChange={() => onToggleLayer("hotspot")} />
            <LayerCheckbox option={viirsOption} checked={query.layers.includes("viirs")} onChange={() => onToggleLayer("viirs")} />
            <button type="button" className="wildfire-layer-sync" onClick={onSync} disabled={syncing}><i className={syncing ? "bi bi-arrow-repeat wildfire-spin" : "bi bi-cloud-arrow-down"} aria-hidden="true" /> {syncing ? "Memperbarui data..." : "Perbarui dari NASA FIRMS"}</button>
            {syncError && <div className="wildfire-layer-error" role="alert"><i className="bi bi-exclamation-triangle" /> {syncError}</div>}
            <div className="wildfire-layer-note"><i className="bi bi-database-check" aria-hidden="true" /> Tampilan membaca database. NASA dipanggil saat sinkronisasi.</div>
          </div>
        )}

        {tab === "overlays" && (
          <div className="wildfire-layer-list" role="tabpanel">
            {overlayOptions.map((option) => (
              <LayerCheckbox key={option.id} option={option} checked={query.layers.includes(option.id)} onChange={() => onToggleLayer(option.id)} />
            ))}
          </div>
        )}

        {tab === "fdrs" && (
          <div className="wildfire-fdrs-panel" role="tabpanel">
            <div className="wildfire-fdrs-status"><i className="bi bi-info-circle" aria-hidden="true" /><span>Feed FDRS BMKG belum terhubung di SaveGeo.</span></div>
            <div className="wildfire-fdrs-list">
              {fdrsOptions.map((label) => <div key={label} className="wildfire-fdrs-row"><span>{label}</span><small>Belum tersedia</small></div>)}
            </div>
            <small className="wildfire-layer-source">Sumber target: Spartan BMKG / SiPongi+</small>
          </div>
        )}
      </div>}
    </div>
  );
}
