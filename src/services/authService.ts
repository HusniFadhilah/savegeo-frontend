import type { LoginResponse, AdminUser } from "@/types/api";
import { apiClient } from "@/services/apiClient";

/**
 * localStorage (not sessionStorage): token persists across tabs/windows and
 * browser restarts, cleared only by explicit logout or the backend rejecting
 * an expired token (see apiClient's 401 handling). Previously sessionStorage,
 * which is scoped per-tab - logging in in one tab left every other tab
 * (including one you already had open, or a fresh one you open next) still
 * showing the login form, which read as "I just logged in and it's asking
 * again" even though nothing was actually broken. Trade-off: on a shared
 * machine, anyone using the same browser profile inherits the session until
 * someone logs out - only use this build on a personal machine. We only ever
 * store the bearer token + minimal user display info here, nothing else
 * sensitive.
 */
const TOKEN_KEY = "savegeo_admin_token";
const USER_KEY = "savegeo_admin_user";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function storeAuth(res: LoginResponse): void {
  localStorage.setItem(TOKEN_KEY, res.token);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/admin/auth/login", { username, password });
    storeAuth(res);
    return res;
  },
  logout(): void {
    clearAuthToken();
  },
  isAuthenticated(): boolean {
    return Boolean(getAuthToken());
  },
};
