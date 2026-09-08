import type { LoginResponse, AdminUser } from "@/types/api";
import { apiClient } from "@/services/apiClient";

/** The JWT is held by the backend in an HttpOnly cookie, never Web Storage. */
const TOKEN_KEY = "savegeo_admin_token";
const USER_KEY = "savegeo_admin_user";

function clearLegacyStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

clearLegacyStorage();

export function getAuthToken(): string | null { return null; }

export function getStoredUser(): AdminUser | null { return null; }

export function clearAuthToken(): void {
  clearLegacyStorage();
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/admin/auth/login", { username, password });
    return res;
  },
  me(): Promise<AdminUser> {
    return apiClient.get<AdminUser>("/admin/auth/me", { auth: "admin" });
  },
  forgotPassword(identifier: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/admin/auth/forgot-password", { identifier });
  },
  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/admin/auth/reset-password", { token, password });
  },
  async logout(): Promise<void> {
    await apiClient.post("/admin/auth/logout").catch(() => undefined);
    clearAuthToken();
  },
  isAuthenticated(): boolean {
    return false;
  },
};
