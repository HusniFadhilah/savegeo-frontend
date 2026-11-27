import type { ReactNode } from "react";
import { bilingualCopy } from "@/hooks/useBilingualCopy";
import type { ChatAction } from "../types";

/**
 * Human-readable description of an AI action, shown in confirmation cards
 * and "steps executed" history cards. Ported 1:1 from savegeo-chatbot.js
 * `actionLabel()`, rendered as JSX instead of an HTML string.
 */
export function actionLabel(action: ChatAction): ReactNode {
  if (action.action) {
    const params = action.parameters ?? {};
    const names: Record<string, [string, string]> = {
      "carbon.analysis": ["karbon / tutupan lahan / vegetasi", "carbon / land cover / vegetation"],
      "lc_change.analysis": ["perubahan tutupan lahan", "land-cover change"],
      "crop.analysis": ["pemantauan tanaman", "crop monitoring"],
      "disaster.dem": ["DEM dan kemiringan", "DEM and slope"],
      "disaster.event": ["dampak bencana", "disaster impact"],
    };
    const label: Record<string, [string, string]> = {
      select_aoi: ["Pilih AOI dan arahkan peta", "Select an AOI and focus the map"],
      select_field: ["Pilih lahan tanaman", "Select a crop field"],
      open_module: ["Buka modul", "Open module"],
      set_provider: ["Pilih penyedia", "Select provider"],
      set_analysis_type: ["Pilih jenis analisis", "Select analysis type"],
      set_parameter: ["Atur parameter", "Set parameter"],
      set_date_range: ["Atur periode", "Set date range"],
      search_scenes: ["Cari citra untuk AOI", "Search scenes for the AOI"],
      show_scene: ["Tampilkan citra", "Show scene"],
      run_analysis: ["Jalankan analisis", "Run analysis"],
      toggle_layer: ["Atur layer hasil", "Toggle result layer"],
      accordion: ["Atur panel citra", "Toggle scene panel"],
      clear_scenes: ["Bersihkan citra", "Clear scenes"],
      load_disaster_sources: ["Muat sumber bencana", "Load disaster sources"],
      load_disaster_alerts: ["Muat peringatan BMKG", "Load BMKG alerts"],
    };
    const detail =
      action.action === "run_analysis"
        ? names[action.target || ""]
          ? bilingualCopy(...names[action.target || ""])
          : undefined
        : (params.query ?? params.value ?? params.field_id ?? params.scene_id);
    return (
      <>
        {label[action.action] ? bilingualCopy(...label[action.action]) : action.action}
        {detail != null && (
          <>
            : <strong>{String(detail)}</strong>
          </>
        )}
        {action.action === "set_date_range" && (
          <>
            : {String(params.start)} – {String(params.end)}
          </>
        )}
        {action.action === "run_analysis" && action.target === "disaster.event" && (
          <>
            {" "}
            ({String(params.event_type)}; {String(params.before_start)}–{String(params.before_end)}{" "}
            / {String(params.after_start)}–{String(params.after_end)})
          </>
        )}
        {action.reason && <small className="d-block">{action.reason}</small>}
      </>
    );
  }
  switch (action.type) {
    case "switch_module":
      return (
        <>
          {bilingualCopy("Pindah ke modul", "Open module")} <strong>{action.module || ""}</strong>
        </>
      );
    case "set_value":
      return (
        <>
          {bilingualCopy("Atur", "Set")} <strong>{action.target || ""}</strong> &rarr;{" "}
          {action.value != null ? String(action.value) : ""}
        </>
      );
    case "run_analysis":
      return (
        <>
          {bilingualCopy("Jalankan analisis", "Run analysis")} <strong>{action.analysis || ""}</strong>
        </>
      );
    case "show_result_layer":
      return (
        <>
          {bilingualCopy("Tampilkan layer", "Show layer")} <strong>{action.layer || ""}</strong>
        </>
      );
    case "download_report":
      return (
        <>
          {bilingualCopy("Unduh", "Download")} <strong>{action.report || ""}</strong>
        </>
      );
    case "fly_to":
      return (
        <>
          🗺️ {bilingualCopy("Pindah peta ke", "Move map to")} <strong>{action.query || action.label || bilingualCopy("lokasi", "location")}</strong>
        </>
      );
    case "set_aoi_geocode":
      return (
        <>
          📍 {bilingualCopy("Atur AOI", "Set AOI")} &rarr; <strong>{action.query || ""}</strong>
        </>
      );
    case "guide_step":
      return (
        <>
          📋 {bilingualCopy("Langkah", "Step")} {action.step || 1}/{action.total || 1}: {action.title || ""}
        </>
      );
    case "highlight_ui":
      return (
        <>
          👆 {bilingualCopy("Sorot elemen", "Highlight element")} <strong>{action.element_id || ""}</strong>
        </>
      );
    case "request_file_aoi":
      return bilingualCopy("📎 Minta unggah file AOI", "📎 Request AOI file upload");
    case "open_draw_tool":
      return bilingualCopy("✏️ Buka alat gambar AOI", "✏️ Open AOI drawing tool");
    case "ask_user":
      return <em>{action.question || ""}</em>;
    case "explain":
      return <>{bilingualCopy("Jelaskan:", "Explain:")} {action.topic || ""}</>;
    case "offer_choices":
      return <>🔘 {action.question || bilingualCopy("Pilih opsi", "Choose an option")}</>;
    case "download_boundary_geojson":
      return (
        <>
          ⬇️ {bilingualCopy("Ambil batas wilayah GeoJSON:", "Get GeoJSON boundary:")} <strong>{action.query || ""}</strong>
        </>
      );
    default:
      return action.type;
  }
}
