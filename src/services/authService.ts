import type { LoginResponse, AdminUser } from "@/types/api";
import { apiClient } from "@/services/apiClient";

/**
 * sessionStorage (not localStorage): token dies with the tab, never persists
 * across sessions on a shared machine. We only ever store the bearer token +
 * minimal user display info here, nothing else sensitive.
 */
const TOKEN_KEY = "savegeo_admin_token";
const USER_KEY = "savegeo_admin_user";

export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function storeAuth(res: LoginResponse): void {
  sessionStorage.setItem(TOKEN_KEY, res.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
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
