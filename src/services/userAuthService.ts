import { apiClient } from "@/services/apiClient";

/**
 * Mirrors `services/authService.ts` exactly, but for the new public-facing
 * `users` table (Disaster Intelligence Dashboard) instead of `admin_users`.
 * Kept as a fully separate module (own sessionStorage keys, own token) per
 * the redesign contract doc - admin and user are different login systems
 * that must never share or clobber each other's session.
 *
 * sessionStorage (not localStorage): token dies with the tab, same rationale
 * as authService.ts.
 */
const TOKEN_KEY = "savegeo_user_token";
const USER_KEY = "savegeo_user_user";

export interface AppUser {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
}

export interface UserLoginResponse {
  token: string;
  user: AppUser;
}

export function getUserAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredAppUser(): AppUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function clearUserAuthToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function storeUserAuth(res: UserLoginResponse): void {
  sessionStorage.setItem(TOKEN_KEY, res.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

/** `{ Authorization: "Bearer <token>" }` (or `{}` if logged out) - pass this
 * as `headers` on every `/auth/me` and `/disasters/*` call instead of
 * `apiClient`'s `auth: true`, which is hardcoded to the *admin* token. See
 * `features/disaster/api.ts`'s `userGet`/`userPost` doc comment for the full
 * rationale (keeps admin/user sessions from clobbering each other without
 * touching `apiClient.ts`, which is out of this feature's file boundary). */
export function userAuthHeader(): Record<string, string> {
  const token = getUserAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    const res = await apiClient.post<UserLoginResponse>("/auth/login", { username, password });
    storeUserAuth(res);
    return res;
  },
  async register(username: string, email: string, password: string): Promise<UserLoginResponse> {
    const res = await apiClient.post<UserLoginResponse>("/auth/register", { username, email, password });
    storeUserAuth(res);
    return res;
  },
  forgotPassword(identifier: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/forgot-password", { identifier });
  },
  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/reset-password", { token, password });
  },
  logout(): void {
    clearUserAuthToken();
  },
  isAuthenticated(): boolean {
    return Boolean(getUserAuthToken());
  },
};
