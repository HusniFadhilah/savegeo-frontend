import type { AoiState, AnalysisProcessingTimes } from "@/features/carbon/types";
import type { CarbonPoolResults, CarbonResult } from "@/features/carbon/types";
import type { VegetationResult } from "@/features/vegetation/types";
import type { LandCoverResult } from "@/features/landcover/types";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";
import type { DirectReferenceLayer } from "@/features/carbon/api";
import { renderRasterPreview } from "./rasterPreview";
import type { GreenRankingResult } from "@/features/carbon/extendedTypes";

export interface AnalysisResultsBundle {
  vegetation?: VegetationResult | null;
  landcover?: LandCoverResult | null;
  carbon?: CarbonResult | null;
  carbonPools?: CarbonPoolResults | null;
  carbonExtensions?: Record<string, CarbonResult>;
  greenRanking?: GreenRankingResult;
  direct?: DirectReferenceLayer[] | null;
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

  const carbonResults = ctx.results.carbonPools
    ? Object.entries(ctx.results.carbonPools).map(([pool, result]) => [pool.toUpperCase(), result] as const)
    : ctx.results.carbon ? [["Carbon Stock", ctx.results.carbon] as const] : [];
  for (const [poolLabel, carbon] of carbonResults) {
    if (!carbon) continue;
    const stats = carbon.carbon_estimated?.statistics || {};
    const ai = carbon.area_info || {};
    const mi = carbon.model_info || {};
    const unit = carbon.carbon_estimated.unit || "Mg C/ha";
    report += `## Carbon Stock Analysis - ${poolLabel}\n\n`;
    report += `### Carbon Density Statistics\n`;
    report += `- Mean: ${stats.mean?.toFixed(2) ?? "N/A"} ${unit}\n`;
    report += `- Std Dev: ${stats.std_dev?.toFixed(2) ?? "N/A"} ${unit}\n`;
    report += `- Min: ${stats.min?.toFixed(2) ?? "N/A"} ${unit}\n`;
    report += `- Max: ${stats.max?.toFixed(2) ?? "N/A"} ${unit}\n\n`;
    report += `### Total Carbon Stock\n`;
    report += `- Calculation Area: ${(ai.calculation_area_ha ?? 0).toLocaleString()} ha\n`;
    report += `- Total Carbon: ${ai.total_carbon_tons?.toLocaleString() ?? "N/A"} tons\n`;
    report += `- CO2 Equivalent: ${ai.carbon_dioxide_equivalent_tons?.toLocaleString() ?? "N/A"} tons CO2e\n`;
    report += `- Reference Dataset: ${mi.reference_dataset ?? "N/A"} (${mi.reference_dataset_year ?? "N/A"})\n\n`;
    if (mi.target_pool) report += `- Carbon pool: ${mi.target_pool}\n`;
    if (mi.depth_cm) report += `- Soil depth: ${mi.depth_cm.join("-")} cm\n`;
    if (mi.source_period) report += `- Source period: ${mi.source_period}\n`;
    if (mi.method_description) report += `- Method: ${mi.method_description}\n`;
    if (mi.validation_metrics) report += `- Spatial reference holdout metrics: ${JSON.stringify(mi.validation_metrics)}\n- ${mi.validation_note ?? "Reference agreement; independent field validation required."}\n`;
  }

  report += `\n---\n*Generated by SAVEGEO - AI Imagery Analytics Platform*`;

  const blob = new Blob([report], { type: "text/markdown" });
  triggerDownload(blob, `savegeo_report_${ctx.aoi.name.replace(/\s+/g, "_")}_${Date.now()}.md`);
}

/** Paginated, searchable PDF assembled from the completed analysis, without rerunning inference. */
export async function generatePdfReport(ctx: ReportContext, download = true, rasterRenderer = renderRasterPreview) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const width = 174;
  let y = 30;
  const number = (value: unknown, digits = 2) => typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("id-ID", { maximumFractionDigits: digits }) : "Tidak tersedia";
  const clean = (value: unknown) => String(value ?? "Tidak tersedia").replace(/→/g, "->").replace(/[–—]/g, "-").replace(/²/g, "2").replace(/₂/g, "2");
  const room = (height: number) => { if (y + height > 277) { pdf.addPage(); y = 30; } };
  const text = (value: unknown, bold = false, size = 10) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(clean(value), width) as string[];
    for (const line of lines) { room(5.5); pdf.text(line, 18, y); y += 5.5; }
    y += 2;
  };
  const section = (title: string) => { room(22); y += 3; pdf.setTextColor(24, 100, 62); text(title, true, 13); pdf.setTextColor(35, 45, 55); };
  const row = (label: string, value: unknown) => {
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(clean(value), 108) as string[];
    const labels = pdf.splitTextToSize(clean(label), 56) as string[];
    const height = Math.max(8, Math.max(lines.length, labels.length) * 5 + 3);
    room(height);
    pdf.setFillColor(245, 248, 246); pdf.rect(18, y - 4, width, height, "F");
    pdf.text(labels, 21, y); pdf.text(lines, 81, y); y += height;
  };
  text("LAPORAN ANALISIS SAVEGEO", true, 20);
  text(ctx.aoi.name, true, 16);
  text(`Dibuat ${new Date().toLocaleString("id-ID")} | ${ctx.analysisType}`);
  section("1. Wilayah dan parameter analisis");
  row("Wilayah", ctx.aoi.name);
  row("Luas AOI (km2)", number(ctx.aoi.areaKm2));
  row("Periode diminta", `${ctx.startMonth}/${ctx.year} - ${ctx.endMonth}/${ctx.year}`);
  row("Batas awan scene", `${ctx.cloudThreshold}%`);
  row("Indeks dipilih", ctx.selectedIndices.join(", ") || "Tidak digunakan");
  const geometry = ctx.aoi.feature?.geometry;
  if (geometry?.type === "Polygon" || geometry?.type === "MultiPolygon") {
    const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
    const points = rings.flat();
    const [west, south, east, north] = points.reduce((bounds, point) => [Math.min(bounds[0], point[0]), Math.min(bounds[1], point[1]), Math.max(bounds[2], point[0]), Math.max(bounds[3], point[1])], [Infinity, Infinity, -Infinity, -Infinity]);
    if (east > west && north > south) {
      room(58); pdf.setDrawColor(30, 120, 75);
      const factor = Math.min(width / (east - west), 40 / (north - south));
      for (const ring of rings) {
        for (let i = 1; i < ring.length; i++) pdf.line(18 + (ring[i - 1][0] - west) * factor, y + (north - ring[i - 1][1]) * factor, 18 + (ring[i][0] - west) * factor, y + (north - ring[i][1]) * factor);
      }
      y += 45; text("Batas AOI (sketsa geografis). Peta raster tiap pool disajikan pada halaman berikut; data georeferensi tersedia melalui ekspor GeoTIFF.", false, 9);
    }
  }
  text("Tahun estimasi, tahun sumber referensi, dan periode observasi dapat berbeda. Hasil berikut mempertahankan metadata masing-masing pool.");
  const pools = [...(ctx.results.carbon ? [["karbon", ctx.results.carbon] as const] : []), ...Object.entries(ctx.results.carbonPools || {}), ...Object.entries(ctx.results.carbonExtensions || {})];
  section("2. Ringkasan hasil karbon");
  if (!pools.length) text("Tidak ada hasil karbon pada analisis ini.");
  for (const [pool, result] of pools) {
    if (!result) continue;
    const stats = result.carbon_estimated.statistics;
    row(`${pool.toUpperCase()} - densitas`, `${number(stats?.mean)} ${result.carbon_estimated.unit || "Mg C/ha"}`);
    row(`${pool.toUpperCase()} - total`, `${number(result.area_info.total_carbon_tons)} ${(result.carbon_estimated.unit || "Mg C/ha").replace("/ha", "")}`);
  }
  text("Stok total tiap pool tidak dijumlahkan otomatis: pastikan batas wilayah, luas valid, unit, kedalaman tanah, dan periode sumber sebanding. Biomassa (Mg biomassa) dan karbon (Mg C) merupakan besaran berbeda.");
  for (const [pool, result] of pools) {
    if (!result) continue;
    const tileUrl = result.carbon_estimated.tile_url || result.carbon_reference?.tile_url;
    if (!tileUrl) throw new Error(`Peta raster ${pool.toUpperCase()} belum tersedia. Jalankan ulang analisis sebelum mengunduh PDF.`);
    const raster = await rasterRenderer(tileUrl, ctx.aoi);
    pdf.addPage(); y = 30;
    section(`Peta raster ${pool.toUpperCase()}`);
    pdf.addImage(raster, "PNG", 18, y, width, width * 480 / 768); y += width * 480 / 768 + 8;
    const visual = result.carbon_estimated.vis_params || result.carbon_reference?.vis_params;
    const colors = visual?.palette || [];
    if (colors.length) {
      const cell = width / colors.length;
      colors.forEach((color, index) => { pdf.setFillColor(color.startsWith("#") ? color : `#${color}`); pdf.rect(18 + index * cell, y, cell, 4, "F"); }); y += 10;
    }
    text(`Legenda: ${number(visual?.min)} - ${number(visual?.max)} ${result.carbon_estimated.unit || "Mg C/ha"}`);
    text(`Sumber: ${result.carbon_reference?.name || result.model_info.reference_dataset || "Hasil analisis"}; tahun analisis ${result.model_info.analysis_year ?? ctx.year}; referensi ${result.model_info.reference_dataset_year ?? "-"}.`);
    text("Peta merupakan pratinjau raster hasil dalam Web Mercator, dengan batas AOI. Piksel transparan menunjukkan area tanpa data valid. Resolusi cetak tidak menambah resolusi sumber.", false, 9);
    section(`Detail ${pool.toUpperCase()}`);
    const mi = result.model_info;
    const stats = result.carbon_estimated.statistics;
    row("Model / versi", `${mi.model_name || "Referensi langsung"} / ${mi.model_version || "-"}`);
    row("Dataset referensi", result.carbon_reference?.full_name || result.carbon_reference?.name || mi.reference_dataset);
    row("Tahun estimasi", mi.analysis_year ?? ctx.year);
    row("Tahun referensi", mi.reference_dataset_year ?? result.carbon_reference?.year);
    row("Observasi hingga", mi.observed_through || (mi.analysis_year_partial ? "Tahun berjalan; data belum lengkap" : "Tidak dicantumkan"));
    row("Mode hasil", mi.analysis_year_mode || mi.display_mode || result.carbon_estimated.inference_mode);
    row("Periode sumber", mi.source_period || result.carbon_estimated.source_period);
    row("Kedalaman tanah (cm)", mi.depth_cm?.join(" - ") || result.carbon_estimated.depth_cm?.join(" - ") || "Tidak berlaku / tidak tersedia");
    row("Skala statistik (m)", number(mi.scale, 0));
    row("Luas perhitungan (ha)", number(result.area_info.calculation_area_ha ?? result.area_info.area_ha));
    row("Minimum / maksimum", `${number(stats?.min)} / ${number(stats?.max)} ${result.carbon_estimated.unit || "Mg C/ha"}`);
    row("Rata-rata / simpangan baku", `${number(stats?.mean)} / ${number(stats?.std_dev)}`);
    if (stats?.percentiles) row("P25 / median / P75", `${number(stats.percentiles.p25)} / ${number(stats.percentiles.median)} / ${number(stats.percentiles.p75)}`);
    row(result.carbon_estimated.quantity === "productivity" ? "Produktivitas (Mg C/tahun)" : "Stok total (Mg C)", number(result.area_info.total_carbon_tons));
    row("Ekuivalen (Mg CO2e)", number(result.area_info.carbon_dioxide_equivalent_tons));
    row("Piksel valid (%)", number(result.data_quality?.valid_pixel_pct));
    row("Jumlah citra", number(mi.images_used ?? result.data_quality?.images_used, 0));
    text(mi.method_description || result.carbon_estimated.description || result.carbon_reference?.description || "Metode rinci tidak dicantumkan pada hasil tersimpan.");
    if (mi.source_url) text(`Sumber: ${mi.source_url}`);
    const factors = mi.extension_payload?.extension_settings;
    if (factors) {
      const labels: Record<string, string> = { density: "Koefisien (Mg C/ha)", agb_density: "AGB input (Mg C/ha)", bgb_density: "BGB input (Mg C/ha)", soc_density: "SOC input (Mg C/ha)", soil_depth_cm: "Kedalaman sedimen (cm)" };
      for (const [key, label] of Object.entries(labels)) if (factors[key] != null) row(label, number(factors[key]));
    }
    if (mi.validation_metrics || mi.cv_metrics) { text("Metrik validasi yang dilaporkan:", true); text(JSON.stringify(mi.validation_metrics || mi.cv_metrics)); }
    text(mi.validation_note || "Kesesuaian dengan raster referensi tidak membuktikan akurasi pengukuran lapangan. Perubahan antar tahun memerlukan validasi independen.");
    if (result.carbon_uncertainty) text(`Ketidakpastian: ${result.carbon_uncertainty.description || "Layer ketidakpastian tersedia pada hasil analisis."}`);
  }
  if (ctx.results.vegetation?.indices) {
    section("Indeks vegetasi");
    for (const [name, stats] of Object.entries(ctx.results.vegetation.indices)) row(name, `Min ${number(stats.min, 4)} | Mean ${number(stats.mean, 4)} | Max ${number(stats.max, 4)} | SD ${number(stats.std_dev, 4)}`);
  }
  if (ctx.results.landcover) {
    section("Tutupan lahan");
    for (const [key, value] of Object.entries(ctx.results.landcover)) {
      if (!isLandCoverDatasetEntry(key, value)) continue;
      text(key, true);
      for (const [name, stats] of Object.entries(value.classes)) row(name, `${number(stats.area)} ha | ${number(stats.percentage)}%`);
    }
  }
  if (ctx.results.greenRanking) {
    const ranking = ctx.results.greenRanking;
    section("Peringkat wilayah hijau");
    text(`Status ${ranking.status}; tingkat ${ranking.config.level}; periode ${ranking.config.start_month}-${ranking.config.end_month}/${ranking.config.year}. ${ranking.statistics.processed} wilayah diproses, ${ranking.statistics.eligible} memenuhi cakupan minimum.`);
    text(ranking.method);
    row("Hijau tertimbang luas (%)", number(ranking.statistics.area_weighted_green_percent));
    row("Rata-rata wilayah (%)", number(ranking.statistics.mean_percent));
    row("Minimum / maksimum (%)", `${number(ranking.statistics.min_percent)} / ${number(ranking.statistics.max_percent)}`);
    text(`Halaman ${ranking.page}; tabel ini berisi ${ranking.rows.length} wilayah. Statistik seluruh hasil dapat diunduh sebagai CSV pada modul peringkat.`);
    for (const region of ranking.rows) row(`${region.rank ?? "-"}. ${region.name}`.slice(0, 34), `${number(region.green_percent)}% hijau; cakupan ${number(region.coverage_percent)}%`);
    text(ranking.boundary_source); text(ranking.source_url);
  }
  section("3. Metode pembacaan dan batas penggunaan");
  text("Densitas adalah stok per hektare pada piksel valid. Stok total mengikuti luas perhitungan yang dilaporkan, yang dapat berbeda dari luas administrasi AOI. Ekuivalen CO2 adalah konversi stok, bukan klaim penyerapan tahunan atau kredit karbon.");
  text("Sumber BGB/SOC dapat berupa baseline historis atau estimasi memakai kovariat tahun analisis. Label tahun estimasi tidak menjadikan raster referensi historis sebagai pengukuran lapangan tahun tersebut. Skala statistik untuk AOI besar dapat lebih kasar daripada resolusi raster sumber.");
  text("Nilai tidak tersedia ditulis eksplisit dan tidak dianggap nol. Peta densitas georeferensi dapat diekspor terpisah sebagai GeoTIFF; dokumen ini merangkum hasil analisis yang tersedia saat laporan dibuat.");
  section("4. Provenans dan reproduksi");
  row("Waktu pemrosesan", Object.entries(ctx.processingTimes || {}).map(([key, value]) => `${key}: ${formatDuration(value)}`).join("; ") || "Tidak tersedia");
  text(`Tautan parameter analisis: ${window.location.href}`);
  text("Simpan unduhan Statistik JSON bersama PDF dan GeoTIFF untuk mempertahankan metadata hasil, parameter, dan detail validasi.");
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFontSize(9); pdf.setTextColor(90, 105, 100);
    pdf.text("SaveGeo | Analisis geospasial", 18, 15); pdf.text(`${page} / ${pages}`, 192, 288, { align: "right" });
  }
  if (download) pdf.save(`savegeo_report_${ctx.aoi.name.replace(/[^\p{L}\p{N}_-]/gu, "_")}_${ctx.year}.pdf`);
  return pdf.output("arraybuffer");
}
