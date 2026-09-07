const USER_TOKEN_KEY = "savegeo_user_token";
const ADMIN_TOKEN_KEY = "savegeo_admin_token";

export type AppAuthKind = "user" | "admin";

/**
 * Shared low-level application session helper. The user and admin sessions
 * intentionally remain in separate storage namespaces; this helper only
 * chooses which existing bearer token to send to an application endpoint.
 */
export function getAppAuthToken(): string | null {
  return sessionStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAppAuthKind(): AppAuthKind | null {
  if (sessionStorage.getItem(USER_TOKEN_KEY)) return "user";
  if (localStorage.getItem(ADMIN_TOKEN_KEY)) return "admin";
  return null;
}

export function appAuthHeader(): Record<string, string> {
  const token = getAppAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let onUnauthorized: (() => void) | null = null;

export function setAppUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function handleAppUnauthorized(): void {
  const kind = getAppAuthKind();
  if (kind === "user") {
    sessionStorage.removeItem(USER_TOKEN_KEY);
    sessionStorage.removeItem("savegeo_user_user");
  } else if (kind === "admin") {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem("savegeo_admin_user");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("savegeo:app-auth-expired", { detail: { kind } }));
  }
  onUnauthorized?.();
}
