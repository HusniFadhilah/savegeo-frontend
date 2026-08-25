import type { DashboardModule } from "@/hooks/useUiStore";

export const DEFAULT_DASHBOARD_MODULE: DashboardModule = "carbon";

export const DASHBOARD_MODULE_PATHS: Record<DashboardModule, string> = {
  carbon: "/carbon-estimation",
  "lc-change": "/land-cover-change",
  imagery: "/satellite-imagery",
  disaster: "/pemetaan-bencana",
  "crop-monitoring": "/crop-monitoring",
  guide: "/guide",
  about: "/about",
};

export const DASHBOARD_MODULE_SEO: Record<DashboardModule, { title: string; description: string }> = {
  carbon: {
    title: "Carbon Estimation | SaveGeo",
    description: "Estimasi stok karbon dan CO2 ekuivalen berbasis citra satelit, AOI, dan model geospasial SaveGeo.",
  },
  "lc-change": {
    title: "Land Cover Change | SaveGeo",
    description: "Analisis perubahan tutupan lahan multi-tahun dengan peta before-after, transisi kelas, dan statistik perubahan.",
  },
  imagery: {
    title: "Satellite Imagery | SaveGeo",
    description: "Eksplorasi citra satelit, tanggal akuisisi, dan layer imagery untuk kebutuhan analisis geospasial.",
  },
  disaster: {
    title: "Pemetaan Bencana | SaveGeo",
    description: "Dashboard pemetaan bencana dan intelligence geospasial untuk monitoring risiko, dampak, dan sumber data pendukung.",
  },
  "crop-monitoring": {
    title: "Crop Monitoring | SaveGeo",
    description: "Monitoring lahan pertanian, kesehatan tanaman, cuaca, moisture, risiko banjir, dan anomali pertumbuhan.",
  },
  guide: {
    title: "Panduan SaveGeo",
    description: "Panduan penggunaan SaveGeo untuk memilih AOI, mengatur parameter, menjalankan analisis, dan membaca hasil.",
  },
  about: {
    title: "Tentang SaveGeo",
    description: "Informasi program riset, tim, mitra, output, dan metodologi platform AI Imagery Analytics SaveGeo.",
  },
};

export function getDashboardModulePath(module: DashboardModule): string {
  return DASHBOARD_MODULE_PATHS[module];
}

export function getDashboardModuleSeo(module: DashboardModule): { title: string; description: string } {
  return DASHBOARD_MODULE_SEO[module];
}
