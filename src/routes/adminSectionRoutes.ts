import type { AdminSection } from "@/features/admin/types";

export const DEFAULT_ADMIN_SECTION: AdminSection = "ov";

export const ADMIN_SECTION_PATHS: Record<AdminSection, string> = {
  ov: "/admin/overview",
  ge: "/admin/gee-credentials",
  ag: "/admin/arcgis",
  ml: "/admin/ml-models",
  cf: "/admin/system-config",
  us: "/admin/users",
  co: "/admin/company-boundaries",
  ds: "/admin/disasters",
  sp: "/admin/satellite-providers",
  gd: "/admin/geospatial-data",
  ri: "/admin/research-information",
};

export const ADMIN_SECTION_SEO: Record<AdminSection, { title: string; description: string }> = {
  ov: {
    title: "Admin Overview | SaveGeo",
    description: "Ringkasan status sistem, Earth Engine, credential aktif, model, dan konfigurasi SaveGeo.",
  },
  ge: {
    title: "GEE Credentials Admin | SaveGeo",
    description: "Kelola service account dan credential Google Earth Engine untuk platform SaveGeo.",
  },
  ag: {
    title: "ArcGIS Admin | SaveGeo",
    description: "Pantau status integrasi ArcGIS Living Atlas dan koneksi portal geospasial SaveGeo.",
  },
  ml: {
    title: "ML Models Admin | SaveGeo",
    description: "Kelola upload, aktivasi, dan model machine learning untuk analisis SaveGeo.",
  },
  cf: {
    title: "System Config Admin | SaveGeo",
    description: "Kelola konfigurasi sistem, AI provider, key pool, dan parameter aplikasi SaveGeo.",
  },
  us: {
    title: "Admin Users | SaveGeo",
    description: "Kelola akun, role, dan akses administrator SaveGeo.",
  },
  co: {
    title: "Company Boundaries Admin | SaveGeo",
    description: "Kelola batas perusahaan, wilayah konsesi, dan data spasial industri SaveGeo.",
  },
  ds: {
    title: "Disaster Management Admin | SaveGeo",
    description: "Kelola kejadian bencana, AOI, imagery, analisis, hotspot, dan publikasi dashboard bencana.",
  },
  sp: {
    title: "Satellite Providers Admin | SaveGeo",
    description: "Kelola provider citra satelit, koleksi GEE, resolusi, band, dan status layer SaveGeo.",
  },
  gd: {
    title: "Geospatial Data Admin | SaveGeo",
    description: "Kelola dataset cloud-native, cache geospasial, dan Spatial SQL SaveGeo.",
  },
  ri: {
    title: "Informasi Riset Admin | SaveGeo",
    description: "Informasi internal riset SaveGeo yang hanya tersedia untuk administrator.",
  },
};

export function getAdminSectionPath(section: AdminSection): string {
  return ADMIN_SECTION_PATHS[section];
}

export function getAdminSectionSeo(section: AdminSection): { title: string; description: string } {
  return ADMIN_SECTION_SEO[section];
}
