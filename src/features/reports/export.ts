import type { AoiState, AnalysisProcessingTimes } from "@/features/carbon/types";
import type { CarbonResult } from "@/features/carbon/types";
import type { VegetationResult } from "@/features/vegetation/types";
import type { LandCoverResult } from "@/features/landcover/types";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";

export interface AnalysisResultsBundle {
  vegetation?: VegetationResult | null;
  landcover?: LandCoverResult | null;
  carbon?: CarbonResult | null;
}

export interface ReportContext {
  aoi: AoiState;
  analysisType: string;
  year: number;
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  selectedIndices: string[];
  processingTimes: AnalysisProcessingTimes;
  results: AnalysisResultsBundle;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Ported from `downloadStatistics()` in main.js: raw JSON dump of results. */
export function downloadStatisticsJson(ctx: ReportContext) {
  const stats = {
    analysis_date: new Date().toISOString(),
    region: ctx.aoi.name,
    area_km2: ctx.aoi.areaKm2,
    year: ctx.year,
    analysis_type: ctx.analysisType,
    parameters: {
      date_range: { start_month: ctx.startMonth, end_month: ctx.endMonth },
      cloud_threshold: ctx.cloudThreshold,
      selected_indices: ctx.selectedIndices,
    },
    processing_times: ctx.processingTimes,
    results: ctx.results,
  };
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" });
  triggerDownload(blob, `savegeo_stats_${ctx.aoi.name.replace(/\s+/g, "_")}_${Date.now()}.json`);
}

function formatDuration(seconds?: string | number): string {
  const sec = parseFloat(String(seconds ?? ""));
  if (!Number.isFinite(sec)) return "-";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const secs = (sec % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

/** Ported from `generateReport()` in main.js: Markdown summary of results. */
export function generateMarkdownReport(ctx: ReportContext) {
  const times = ctx.processingTimes || {};
  let report = `# SAVEGEO Analysis Report\n\n`;
  report += `**Tanggal:** ${new Date().toLocaleString("id-ID")}\n`;
  report += `**Region:** ${ctx.aoi.name}\n`;
  report += `**Luas:** ${ctx.aoi.areaKm2 ?? "-"} km²\n`;
  report += `**Tahun:** ${ctx.year}\n\n`;

  if (times.vegetation || times.landcover || times.carbon || times.total) {
    report += `## Processing Performance\n\n`;
    if (times.vegetation) report += `- **Vegetation:** ${formatDuration(times.vegetation)}\n`;
    if (times.landcover) report += `- **Land Cover:** ${formatDuration(times.landcover)}\n`;
    if (times.carbon) report += `- **Carbon:** ${formatDuration(times.carbon)}\n`;
    if (times.total) report += `- **Total:** ${formatDuration(times.total)}\n`;
    report += "\n";
  }

  const veg = ctx.results.vegetation;
  if (veg?.indices) {
    report += `## Vegetation Indices\n\n`;
    report += `**Images Found:** ${veg.collection_size ?? "-"}\n\n`;
    for (const [index, stats] of Object.entries(veg.indices)) {
      report += `### ${index}\n`;
      report += `- Min: ${Number(stats.min ?? 0).toFixed(4)}\n`;
      report += `- Mean: ${Number(stats.mean ?? 0).toFixed(4)}\n`;
      report += `- Max: ${Number(stats.max ?? 0).toFixed(4)}\n`;
      report += `- Std Dev: ${Number(stats.std_dev ?? 0).toFixed(4)}\n\n`;
    }
  }

  const lc = ctx.results.landcover;
  if (lc) {
    for (const [dsKey, dsVal] of Object.entries(lc)) {
      if (!isLandCoverDatasetEntry(dsKey, dsVal)) continue;
      report += `## Land Cover - ${dsKey.replace(/_/g, " ")}\n\n`;
      for (const [cls, d] of Object.entries(dsVal.classes)) {
        report += `- **${cls}:** ${d.area} ha (${d.percentage}%)\n`;
      }
      report += "\n";
    }
  }

  const carbon = ctx.results.carbon;
  if (carbon) {
    const stats = carbon.carbon_estimated?.statistics || {};
    const ai = carbon.area_info || {};
    const mi = carbon.model_info || {};
    report += `## Carbon Stock Analysis\n\n`;
    report += `### Carbon Density Statistics\n`;
    report += `- Mean: ${(stats.mean ?? 0).toFixed(2)} Mg/ha\n`;
    report += `- Std Dev: ${(stats.std_dev ?? 0).toFixed(2)} Mg/ha\n`;
    report += `- Min: ${(stats.min ?? 0).toFixed(2)} Mg/ha\n`;
    report += `- Max: ${(stats.max ?? 0).toFixed(2)} Mg/ha\n\n`;
    report += `### Total Carbon Stock\n`;
    report += `- Calculation Area: ${(ai.calculation_area_ha ?? 0).toLocaleString()} ha\n`;
    report += `- Total Carbon: ${(ai.total_carbon_tons ?? 0).toLocaleString()} tons\n`;
    report += `- CO2 Equivalent: ${(ai.carbon_dioxide_equivalent_tons ?? 0).toLocaleString()} tons CO2e\n`;
    report += `- Reference Dataset: ${mi.reference_dataset ?? "N/A"} (${mi.reference_dataset_year ?? "N/A"})\n\n`;
  }

  report += `\n---\n*Generated by SAVEGEO - AI Imagery Analytics Platform*`;

  const blob = new Blob([report], { type: "text/markdown" });
  triggerDownload(blob, `savegeo_report_${ctx.aoi.name.replace(/\s+/g, "_")}_${Date.now()}.md`);
}
