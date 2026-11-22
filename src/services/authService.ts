import type { LoginResponse, MfaLoginChallenge, AdminUser } from "@/types/api";
import { ApiError, apiClient } from "@/services/apiClient";

/** The JWT is held by the backend in an HttpOnly cookie, never Web Storage. */
const TOKEN_KEY = "savegeo_admin_token";
const USER_KEY = "savegeo_admin_user";

function clearLegacyStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

clearLegacyStorage();

export function getAuthToken(): string | null {
  return null;
}

export function getStoredUser(): AdminUser | null {
  return null;
}

export function clearAuthToken(): void {
  clearLegacyStorage();
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse | MfaLoginChallenge> {
    const res = await apiClient.post<LoginResponse | MfaLoginChallenge>("/admin/auth/login", {
      username,
      password,
    });
    return res;
  },
  mfaEnrollment(challenge: string) {
    return apiClient.post<{ secret: string; provisioning_uri: string }>(
      "/admin/auth/mfa/enrollment",
      { challenge },
    );
  },
  verifyMfa(challenge: string, code: string) {
    return apiClient.post<{ user: AdminUser; recovery_codes: string[] }>("/admin/auth/mfa/verify", {
      challenge,
      code,
    });
  },
  stepUpMfa(code: string) {
    return apiClient.post<{ message: string }>(
      "/admin/auth/mfa/step-up",
      { code },
      { auth: "admin" },
    );
  },
  resetMfa(password: string, code: string) {
    return apiClient.post<{ message: string }>(
      "/admin/auth/mfa/reset",
      { password, code },
      { auth: "admin" },
    );
  },
  regenerateMfaRecovery(password: string, code: string) {
    return apiClient.post<{ recovery_codes: string[] }>(
      "/admin/auth/mfa/recovery-codes",
      { password, code },
      { auth: "admin" },
    );
  },
  resetAccountMfa(targetUsername: string, password: string, code: string, reason: string) {
    return apiClient.post<{ message: string }>("/admin/auth/mfa/reset-account", { target_username: targetUsername, password, code, reason }, { auth: "admin" });
  },
  mfaSecurityEvents() {
    return apiClient.get<{ id: number; action: string; created_at: string; detail: { reason?: string; actor_username?: string } | null }[]>("/admin/auth/mfa/events", { auth: "admin" });
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
    try {
      await apiClient.post("/admin/auth/logout");
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    clearAuthToken();
  },
  isAuthenticated(): boolean {
    return false;
  },
};
