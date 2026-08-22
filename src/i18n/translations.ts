export type Language = "id" | "en";

/**
 * Chrome-level (nav/sidebar/status/login) strings only. The legacy app's
 * `I18N_EXACT` + `LULC_CLASS_TRANSLATIONS` dictionaries (main.js) cover
 * hundreds of additional analysis-result strings and are NOT ported here -
 * feature modules should extend this dictionary under their own key
 * namespace as they're migrated. See MIGRATION.md.
 */
export const translations: Record<Language, Record<string, string>> = {
  id: {
    "nav.collaboration": "Kolaborasi Universitas Diponegoro – PT LEN Industri",
    "auth.loginAdmin": "Login",
    "auth.dashboard": "Dashboard",
    "auth.logout": "Logout",
    "sidebar.modules": "Modul",
    "sidebar.carbon": "Analisis Stok Karbon",
    "sidebar.landChangeShort": "Perubahan Lahan",
    "sidebar.imagery": "Citra Satelit",
    "sidebar.disaster": "Pemetaan Bencana",
    "sidebar.cropMonitoring": "Pemantauan Tanaman",
    "sidebar.guide": "Panduan Lengkap",
    "sidebar.about": "Tentang Program",
    "sidebar.language": "Bahasa",
    "status.connecting": "Menghubungkan...",
    "status.online": "Terhubung",
    "status.offline": "Terputus",
    "loading.processing": "Memproses data...",
    "loading.wait": "Mohon tunggu",
  },
  en: {
    "nav.collaboration": "Diponegoro University – PT LEN Industri Collaboration",
    "auth.loginAdmin": "Login",
    "auth.dashboard": "Dashboard",
    "auth.logout": "Logout",
    "sidebar.modules": "Modules",
    "sidebar.carbon": "Carbon Stock Analysis",
    "sidebar.landChangeShort": "Land Change",
    "sidebar.imagery": "Satellite Imagery",
    "sidebar.disaster": "Disaster Mapping",
    "sidebar.cropMonitoring": "Crop Monitoring",
    "sidebar.guide": "Full Guide",
    "sidebar.about": "About Program",
    "sidebar.language": "Language",
    "status.connecting": "Connecting...",
    "status.online": "Connected",
    "status.offline": "Disconnected",
    "loading.processing": "Processing data...",
    "loading.wait": "Please wait",
  },
};
