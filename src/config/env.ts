/**
 * Only VITE_-prefixed, non-secret values belong here. Never read secret env
 * vars in frontend code — Vite inlines them into the client bundle at build
 * time, so anything defined here is publicly visible.
 */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || "/api").replace(
    /\/+$/,
    "",
  ),
  appName: import.meta.env.VITE_APP_NAME || "SAVEGEO",
  appEnv: import.meta.env.VITE_APP_ENV || "development",
} as const;
