export type AppAuthKind = "user" | "admin";

/**
 * Shared low-level application session helper. The user and admin sessions
 * intentionally remain in separate storage namespaces; this helper only
 * chooses which existing bearer token to send to an application endpoint.
 */
export function getAppAuthToken(): string | null { return null; }

export function getAppAuthKind(): AppAuthKind | null { return null; }

export function appAuthHeader(): Record<string, string> {
  return {};
}

let onUnauthorized: (() => void) | null = null;

export function setAppUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function handleAppUnauthorized(): void {
  const kind = getAppAuthKind();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("savegeo:app-auth-expired", { detail: { kind } }));
  }
  onUnauthorized?.();
}
