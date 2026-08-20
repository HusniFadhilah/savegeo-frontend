import type { GeoAiContext } from "./types";
import type { QuickAction } from "./types";

/**
 * Dynamic suggested prompts (spec section 8) - what to show instead of an
 * empty chat when the Geo-AI panel first opens. Pure client-side rule based
 * on which analysis kinds are already available in context, no LLM call.
 */
export function buildSuggestedPrompts(ctx: GeoAiContext): QuickAction[] {
  const prompts: QuickAction[] = [];

  if (!ctx.aoi) {
    return [
      { label: "Analisis yang tersedia?", msg: "Analisis apa yang bisa saya lakukan di area ini?" },
      { label: "Dataset tersedia?", msg: "Apa dataset yang tersedia untuk analisis?" },
    ];
  }

  const hasCarbon = !!ctx.results.carbon;
  const hasVegetation = !!ctx.results.vegetation;
  const hasLandcover = !!ctx.results.landcover;
  const hasTransition = !!ctx.results.landcover_transition;

  if (!hasCarbon && !hasVegetation && !hasLandcover && !hasTransition) {
    prompts.push(
      { label: "Kondisi vegetasi", msg: "Bagaimana kondisi vegetasi area ini?" },
      { label: "Analisis yang tersedia?", msg: "Analisis apa yang bisa saya lakukan di area ini?" },
      { label: "Dataset tersedia?", msg: "Apa dataset yang tersedia untuk analisis?" },
    );
    return prompts;
  }

  if (hasTransition) {
    prompts.push(
      { label: "Perubahan terbesar?", msg: "Apa perubahan terbesar antar periode di area ini?" },
      { label: "Cari hotspot perubahan", msg: "Cari hotspot perubahan tutupan lahan terbesar" },
      { label: "Vegetasi hilang?", msg: "Berapa luas vegetasi yang hilang?" },
    );
  }
  if (hasVegetation) {
    prompts.push({ label: "Cari hotspot vegetasi", msg: "Cari area dengan kehilangan vegetasi terbesar" });
  }
  if (hasCarbon) {
    prompts.push(
      { label: "Total carbon stock?", msg: "Berapa total carbon stock area ini?" },
      { label: "Carbon density tertinggi?", msg: "Area mana yang memiliki carbon density tertinggi?" },
    );
  }
  if (hasLandcover && !hasTransition) {
    prompts.push({ label: "Ringkasan tutupan lahan", msg: "Bagaimana ringkasan tutupan lahan area ini?" });
  }

  return prompts.slice(0, 4);
}
