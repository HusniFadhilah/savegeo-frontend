/**
 * frontend\src\config.js
 * Application Configuration
 * Centralized config management using Vite environment variables
 */

const CONFIG = {
    // API Configuration
    api: {
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8086/api',
        timeout: 240000, // 4 minutes
    },

    admin: {
        tokenKey: 'savegeo_admin_token',  // localStorage key untuk JWT
        tokenExpKey: 'savegeo_admin_exp',
    },

    analysis: {
        defaultYear: new Date().getFullYear(),
        yearMin: 2015,
        yearMax: new Date().getFullYear(),
    },

    // Application Info
    app: {
        name: import.meta.env.VITE_APP_NAME || 'GEOSAVE',
        title: import.meta.env.VITE_APP_TITLE || 'GEOSAVE Platform',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
    },

    // Map Configuration
    map: {
        defaultCenter: {
            lat: parseFloat(import.meta.env.VITE_DEFAULT_LAT) || -6.9667,
            lng: parseFloat(import.meta.env.VITE_DEFAULT_LNG) || 110.4167,
        },
        defaultZoom: parseInt(import.meta.env.VITE_DEFAULT_ZOOM) || 10,
        maxZoom: 18,
        minZoom: 5,
        tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles © Esri, Maxar, Earthstar Geographics',
    },

    // Features Toggle
    features: {
        debug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
        analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    },

    // API Keys
    keys: {
        googleMaps: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
    },

    // Development mode check
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    env: 'development',
    appTitle: 'SAVEGEO',
};

// Ekspos ke window agar bisa diakses semua modul
window.CONFIG = CONFIG;
let config = CONFIG; // Alias untuk kemudahan akses

// Log config in development
if (config.isDevelopment && config.features.debug) {
    console.log('🔧 Application Configuration:', config);
}
export default config;
