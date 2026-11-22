import CropPanelAccordion from "./CropPanelAccordion";
import { fmtNum, fmtPct, localizeCropReason } from "../utils";
import type { ProductivityZonesResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  productivityZones: ProductivityZonesResult;
}

const ZONE_ORDER = ["High", "Medium", "Low"];
const ZONE_COLOR: Record<string, string> = { High: "#2e7d32", Medium: "#f9a825", Low: "#c62828" };

/** Sub-analysis H: productivity zones. Weights shown transparently. */
export default function ProductivityZonesPanel({ productivityZones }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <CropPanelAccordion title={t("crop.card.productivityTitle")} icon="bi-grid-3x3-gap-fill">
      {!productivityZones.available ? (
        <div className="alert alert-secondary py-2 mb-0 small">
          {t("crop.unavailable")}{localizeCropReason(productivityZones.reason, t) ? `: ${localizeCropReason(productivityZones.reason, t)}` : "."}
        </div>
      ) : (
        <>
          <div className="table-responsive mb-2">
            <table className="table table-striped table-hover table-sm mb-0">
              <thead className="table-secondary">
                <tr>
                  <th>{t("crop.zone")}</th>
                  <th>{t("crop.areaHa")}</th>
                  <th>{t("crop.percentage")}</th>
                </tr>
              </thead>
              <tbody>
                {ZONE_ORDER.filter((z) => productivityZones.zones[z]).map((z) => (
                  <tr key={z}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          backgroundColor: ZONE_COLOR[z],
                          marginRight: 5,
                          border: "1px solid #ccc",
                        }}
                      />
                      {z === "High" ? t("crop.high") : z === "Medium" ? t("crop.moderate") : t("crop.low")}
                    </td>
                    <td>{fmtNum(productivityZones.zones[z].area_ha, 2)}</td>
                    <td>
                      <span className="badge bg-primary">{fmtPct(productivityZones.zones[z].percentage)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="text-muted d-block">
            {t("crop.weightLabel")}: NDVI {fmtPct((productivityZones.weights.ndvi ?? 0) * 100, 0)}, NDMI{" "}
            {fmtPct((productivityZones.weights.ndmi ?? 0) * 100, 0)}
            {productivityZones.weights.sentinel1_vv != null && `, Sentinel-1 VV ${fmtPct(productivityZones.weights.sentinel1_vv * 100, 0)}`}
            {productivityZones.weights.elevation != null && `, ${t("crop.elevation")} ${fmtPct(productivityZones.weights.elevation * 100, 0)}`}
            {" · "}
            {productivityZones.seasons_used} {t("crop.seasonsUsed")}
          </small>
          {productivityZones.tile_url && (
            <small className="text-muted d-block mt-1">{t("crop.map.layerHint", { layer: t("crop.map.productivity") })}</small>
          )}
        </>
      )}
    </CropPanelAccordion>
  );
}
