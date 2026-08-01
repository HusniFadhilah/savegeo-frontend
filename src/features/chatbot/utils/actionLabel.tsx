import type { ReactNode } from "react";
import type { ChatAction } from "../types";

/**
 * Human-readable description of an AI action, shown in confirmation cards
 * and "steps executed" history cards. Ported 1:1 from savegeo-chatbot.js
 * `actionLabel()`, rendered as JSX instead of an HTML string.
 */
export function actionLabel(action: ChatAction): ReactNode {
  switch (action.type) {
    case "switch_module":
      return (
        <>
          Pindah ke modul <strong>{action.module || ""}</strong>
        </>
      );
    case "set_value":
      return (
        <>
          Atur <strong>{action.target || ""}</strong> &rarr;{" "}
          {action.value != null ? String(action.value) : ""}
        </>
      );
    case "run_analysis":
      return (
        <>
          Jalankan analisis <strong>{action.analysis || ""}</strong>
        </>
      );
    case "show_result_layer":
      return (
        <>
          Tampilkan layer <strong>{action.layer || ""}</strong>
        </>
      );
    case "download_report":
      return (
        <>
          Unduh <strong>{action.report || ""}</strong>
        </>
      );
    case "fly_to":
      return (
        <>
          🗺️ Pindah peta ke <strong>{action.query || action.label || "lokasi"}</strong>
        </>
      );
    case "set_aoi_geocode":
      return (
        <>
          📍 Set AOI &rarr; <strong>{action.query || ""}</strong>
        </>
      );
    case "guide_step":
      return (
        <>
          📋 Langkah {action.step || 1}/{action.total || 1}: {action.title || ""}
        </>
      );
    case "highlight_ui":
      return (
        <>
          👆 Sorot elemen <strong>{action.element_id || ""}</strong>
        </>
      );
    case "request_file_aoi":
      return "📎 Minta upload file AOI";
    case "open_draw_tool":
      return "✏️ Buka alat gambar AOI";
    case "ask_user":
      return <em>{action.question || ""}</em>;
    case "explain":
      return <>Jelaskan: {action.topic || ""}</>;
    case "offer_choices":
      return <>🔘 {action.question || "Pilih opsi"}</>;
    case "download_boundary_geojson":
      return (
        <>
          ⬇️ Ambil batas wilayah GeoJSON: <strong>{action.query || ""}</strong>
        </>
      );
    default:
      return action.type;
  }
}
