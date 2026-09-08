import { apiClient } from "@/services/apiClient";

/**
 * Mirrors `services/authService.ts` exactly, but for the new public-facing
 * `users` table (Disaster Intelligence Dashboard) instead of `admin_users`.
 * The browser session is held by the backend in an HttpOnly cookie. This
 * module deliberately keeps no bearer token in Web Storage.
 */
const LEGACY_TOKEN_KEY = "savegeo_user_token";
const LEGACY_USER_KEY = "savegeo_user_user";

export interface AppUser {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
}

export interface UserLoginResponse {
  token?: string;
  user: AppUser;
}

function clearLegacyStorage(): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_USER_KEY);
}

clearLegacyStorage();

export function getUserAuthToken(): string | null { return null; }

export function getStoredAppUser(): AppUser | null { return null; }

export function clearUserAuthToken(): void {
  clearLegacyStorage();
}

export function userAuthHeader(): Record<string, string> {
  return {};
}

let onUserUnauthorized: (() => void) | null = null;

/** Registered once by `hooks/useUserAuthStore.ts`. Deliberately independent
 * from `apiClient.ts`'s `setUnauthorizedHandler` (a single global slot owned
 * by the admin store) - this is its own local pub/sub scoped only to the
 * user token, so it can never race/overwrite the admin handler regardless of
 * module import order. */
export function setUserUnauthorizedHandler(handler: (() => void) | null): void {
  onUserUnauthorized = handler;
}

/** Call after any user-authenticated request comes back 401. Clears only the
 * user session (never touches the admin token) and notifies the store. */
export function handleUserUnauthorized(): void {
  clearUserAuthToken();
  onUserUnauthorized?.();
}

export const userAuthService = {
  async login(username: string, password: string): Promise<UserLoginResponse> {
    return apiClient.post<UserLoginResponse>("/auth/login", { username, password });
  },
  async register(username: string, email: string, password: string): Promise<UserLoginResponse> {
    return apiClient.post<UserLoginResponse>("/auth/register", { username, email, password });
  },
  me(): Promise<AppUser> {
    return apiClient.get<AppUser>("/auth/me", { auth: "user" });
  },
  forgotPassword(identifier: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/forgot-password", { identifier });
  },
  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/reset-password", { token, password });
  },
  async logout(): Promise<void> {
    await apiClient.post("/auth/logout").catch(() => undefined);
    clearUserAuthToken();
  },
  isAuthenticated(): boolean {
    return false;
  },
};
