import type { QuickAction } from "./types";

/**
 * Chatbot-local i18n dictionary, ported from savegeo-chatbot.js `CHAT_I18N`.
 * Deliberately separate from the shared `src/i18n/translations.ts` (off
 * limits to this feature per the migration task) - only the welcome message
 * and quick-action chips were ever bilingual in the original widget.
 * Everything else in the widget's UI (buttons, placeholders, status text,
 * errors) was hardcoded Indonesian there too, so it stays Indonesian-only
 * here as well.
 */
export const CHAT_I18N: Record<"id" | "en", { welcome: string; quickActions: QuickAction[] }> = {
  id: {
    welcome:
      "Halo, saya SaveGeo Assistant. Saya bisa membantu membaca peta, menjelaskan fitur, memilih dataset, menjalankan analisis, dan membuat ringkasan. Gambar AOI di peta atau tanyakan apa yang ingin dianalisis.",
    quickActions: [
      { label: "Analisis Lengkap", msg: "Tolong lakukan analisis lengkap area ini" },
      { label: "Gunakan AOI Ini", msg: "Gunakan AOI yang sedang aktif di peta" },
      { label: "Analisis Karbon", msg: "Tolong analisis stok karbon area ini" },
      { label: "Tutupan Lahan", msg: "Tolong analisis tutupan lahan area ini" },
      { label: "Bandingkan Perubahan", msg: "Tolong bandingkan perubahan tutupan lahan" },
      { label: "Buat Laporan", msg: "Tolong buat executive summary dari hasil analisis" },
    ],
  },
  en: {
    welcome:
      "Hi, I am SaveGeo Assistant. I can help read the map, explain features, choose datasets, run analyses, and prepare summaries. Draw an AOI on the map or ask what you want to analyze.",
    quickActions: [
      { label: "Full Analysis", msg: "Please run a full analysis for this area" },
      { label: "Use This AOI", msg: "Use the active AOI on the map" },
      { label: "Carbon Analysis", msg: "Please analyze carbon stock for this area" },
      { label: "Land Cover", msg: "Please analyze land cover for this area" },
      { label: "Compare Changes", msg: "Please compare land cover changes" },
      { label: "Create Report", msg: "Please create an executive summary from the analysis results" },
    ],
  },
};
