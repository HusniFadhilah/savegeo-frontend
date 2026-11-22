import { useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { WildfireQueryState } from "./queryState";

type LayerTab = "hotspot" | "overlays" | "cams" | "fdrs";

interface Props {
  query: WildfireQueryState;
  onToggleLayer: (layer: string) => void;
  onCamsScopeChange: (scope: "event" | "world") => void;
  viirsAvailable: boolean | null;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
  camsStatus: "idle" | "loading" | "ready" | "empty" | "error";
  onRetryCams: () => void;
}

interface LayerOption {
  id: string;
  label: string;
  description?: string;
  available: boolean;
}

const overlayOptions: LayerOption[] = [
  { id: "boundary", label: "", available: true },
  { id: "clouds", label: "", description: "", available: false },
  { id: "wind", label: "", description: "", available: true },
  { id: "air-quality", label: "", description: "", available: false },
  { id: "rain", label: "", description: "", available: false },
  { id: "units", label: "", description: "", available: false },
  { id: "suppression", label: "", description: "", available: false },
  { id: "groundcheck", label: "", description: "", available: false },
  { id: "peat-water", label: "", description: "", available: false },
];

const fdrsOptions = [
  "Fine Fuel Moisture Code",
  "Duff Moisture Code",
  "Drought Code",
  "Build Up Index",
  "Initial Spread Index",
  "Fire Weather Index",
];

function LayerCheckbox({
  option,
  checked,
  onChange,
}: {
  option: LayerOption;
  checked: boolean;
  onChange: () => void;
}) {
  const t = useI18nStore((state) => state.t);
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
      {!option.available && <span className="wildfire-layer-status">{t("wildfire.layers.comingSoon")}</span>}
    </label>
  );
}

export default function WildfireLayerPanel({
  query,
  onToggleLayer,
  onCamsScopeChange,
  viirsAvailable,
  onSync,
  syncing,
  syncError,
  camsStatus,
  onRetryCams,
}: Props) {
  const t = useI18nStore((state) => state.t);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LayerTab>("hotspot");
  const viirsOption: LayerOption = {
    id: "viirs",
    label: "VIIRS / NASA FIRMS",
    description:
      viirsAvailable === false ? t("wildfire.layers.noPeriodData") : t("wildfire.layers.storedHotspots"),
    available: true,
  };

  return (
    <div className="leaflet-top leaflet-right wildfire-layer-control">
      <button
        type="button"
        className={`wildfire-layer-trigger leaflet-control ${open ? "is-active" : ""}`}
        title={t("wildfire.layers.show")}
        aria-label={t("wildfire.layers.show")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="bi bi-gear" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="wildfire-layer-panel leaflet-control"
          role="dialog"
          aria-label={t("wildfire.layers.dialogLabel")}
        >
          <div className="wildfire-layer-heading">
            <div>
              <i className="bi bi-layers" aria-hidden="true" />
              <strong>{t("wildfire.layers.title")}</strong>
            </div>
            <button
              type="button"
              className="wildfire-layer-close"
              aria-label={t("wildfire.layers.close")}
              onClick={() => setOpen(false)}
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div className="wildfire-layer-tabs" role="tablist" aria-label={t("wildfire.layers.types")}>
            {(
              [
                ["hotspot", t("wildfire.layers.hotspots")],
                ["overlays", t("wildfire.layers.overlays")],
                ["cams", "CAMS"],
                ["fdrs", "FDRS"],
              ] as const
            ).map(([id, label]) => (
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
              <LayerCheckbox
                option={{
                  id: "hotspot",
                  label: t("wildfire.layers.storedHotspots"),
                  description: t("wildfire.layers.nasaStoredDescription"),
                  available: true,
                }}
                checked={query.layers.includes("hotspot")}
                onChange={() => onToggleLayer("hotspot")}
              />
              <LayerCheckbox
                option={viirsOption}
                checked={query.layers.includes("viirs")}
                onChange={() => onToggleLayer("viirs")}
              />
              <button
                type="button"
                className="wildfire-layer-sync"
                onClick={onSync}
                disabled={syncing}
              >
                <i
                  className={
                    syncing ? "bi bi-arrow-repeat wildfire-spin" : "bi bi-cloud-arrow-down"
                  }
                  aria-hidden="true"
                />{" "}
                {syncing ? t("wildfire.layers.updating") : t("wildfire.layers.updateFromNasa")}
              </button>
              {syncError && (
                <div className="wildfire-layer-error" role="alert">
                  <i className="bi bi-exclamation-triangle" /> {syncError}
                </div>
              )}
              <div className="wildfire-layer-note">
                <i className="bi bi-database-check" aria-hidden="true" /> {t("wildfire.layers.databaseNote")}
              </div>
            </div>
          )}

          {tab === "overlays" && (
            <div className="wildfire-layer-list" role="tabpanel">
              {overlayOptions.map((option) => (
                <LayerCheckbox
                  key={option.id}
                  option={{
                    ...option,
                    label: t(`wildfire.layers.overlay.${option.id}.label`),
                    description: option.id === "wind"
                      ? "Open-Meteo"
                      : t(`wildfire.layers.overlay.${option.id}.description`),
                  }}
                  checked={query.layers.includes(option.id)}
                  onChange={() => onToggleLayer(option.id)}
                />
              ))}
            </div>
          )}

          {tab === "cams" && (
            <div className="wildfire-layer-list" role="tabpanel">
              <fieldset className="wildfire-cams-scope">
                <legend>{t("wildfire.layers.aerosolCoverage")}</legend>
                <label>
                  <input
                    type="radio"
                    name="wildfire-cams-scope"
                    checked={query.camsScope === "event"}
                    onChange={() => onCamsScopeChange("event")}
                  />
                  {t("wildfire.layers.eventRegion")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="wildfire-cams-scope"
                    checked={query.camsScope === "world"}
                    onChange={() => onCamsScopeChange("world")}
                  />
                  {t("wildfire.layers.world")}
                </label>
                <small>{t("wildfire.layers.gfasEventScope")}</small>
              </fieldset>
              <LayerCheckbox
                option={{
                  id: "cams-gfas",
                  label: t("wildfire.layers.gfasLabel"),
                  description: t("wildfire.layers.latestAvailableFrame"),
                  available: true,
                }}
                checked={query.layers.includes("cams-gfas")}
                onChange={() => onToggleLayer("cams-gfas")}
              />
              <LayerCheckbox
                option={{
                  id: "cams-aod",
                  label: t("wildfire.layers.aerosolLabel"),
                  description: t("wildfire.layers.opticalDepth"),
                  available: true,
                }}
                checked={query.layers.includes("cams-aod")}
                onChange={() => onToggleLayer("cams-aod")}
              />
              <div className="wildfire-layer-note" role={camsStatus === "error" ? "alert" : "status"}>
                <i className={`bi ${camsStatus === "error" || camsStatus === "empty" ? "bi-exclamation-triangle" : camsStatus === "loading" ? "bi-arrow-repeat wildfire-spin" : "bi-info-circle"}`} aria-hidden="true" />
                <span>
                  {camsStatus === "loading"
                    ? t("wildfire.layers.camsLoading")
                    : camsStatus === "error"
                      ? t("wildfire.layers.camsLoadError")
                      : camsStatus === "empty"
                        ? t("wildfire.layers.camsNoRaster")
                        : camsStatus === "ready"
                          ? query.camsScope === "world" && query.layers.includes("cams-aod")
                            ? t("wildfire.layers.camsGlobalActive")
                            : t("wildfire.layers.camsArchiveControls")
                          : t("wildfire.layers.camsChooseLayer")}
                  {camsStatus === "error" && <> <button type="button" className="wildfire-layer-retry" onClick={onRetryCams}>{t("wildfire.layers.retry")}</button></>}
                </span>
              </div>
            </div>
          )}

          {tab === "fdrs" && (
            <div className="wildfire-fdrs-panel" role="tabpanel">
              <div className="wildfire-fdrs-status">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>{t("wildfire.layers.fdrsUnavailable")}</span>
              </div>
              <div className="wildfire-fdrs-list">
                {fdrsOptions.map((label) => (
                  <div key={label} className="wildfire-fdrs-row">
                    <span>{label}</span>
                    <small>{t("wildfire.layers.unavailable")}</small>
                  </div>
                ))}
              </div>
              <small className="wildfire-layer-source">
                {t("wildfire.layers.fdrsSource")}
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
