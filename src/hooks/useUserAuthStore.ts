import { create } from "zustand";
import { ApiError } from "@/services/apiClient";
import {
  setUserUnauthorizedHandler,
  userAuthService,
  type AppUser,
} from "@/services/userAuthService";
import { useI18nStore } from "@/hooks/useI18nStore";

function friendlyAuthError(err: unknown, fallbackKey: string): string {
  const raw = err instanceof ApiError ? err.message.toLowerCase() : "";
  const t = useI18nStore.getState().t;
  if (raw.includes("bearer") || raw.includes("unauthorized") || raw.includes("401")) return t("errors.authRequired");
  if (raw.includes("network") || raw.includes("fetch")) return t("errors.serverUnavailable");
  return t(fallbackKey);
}

interface UserAuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  initialize: () => Promise<void>;
}

/**
 * Mirrors `hooks/useAuthStore.ts` exactly, for the separate public `users`
 * table. Registers its own 401 handler via `userAuthService`'s local
 * pub/sub (not `apiClient.ts`'s single global `setUnauthorizedHandler` slot,
 * which stays admin-only) - see `features/disaster/api.ts`'s doc comment for
 * the full rationale.
 */
export const useUserAuthStore = create<UserAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      await userAuthService.login(username, password);
      const user = await userAuthService.me();
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: friendlyAuthError(err, "auth.loginFailed"), isLoading: false });
      return false;
    }
  },
  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      await userAuthService.register(username, email, password);
      const user = await userAuthService.me();
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: friendlyAuthError(err, "auth.registerFailed"), isLoading: false });
      return false;
    }
  },
  logout: () => {
    void userAuthService.logout();
    set({ user: null, isAuthenticated: false });
  },
  initialize: async () => {
    try {
      const user = await userAuthService.me();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

void useUserAuthStore.getState().initialize();

setUserUnauthorizedHandler(() => {
  useUserAuthStore.setState({ user: null, isAuthenticated: false, error: useI18nStore.getState().t("errors.sessionExpired") });
});

if (typeof window !== "undefined") {
  window.addEventListener("savegeo:app-auth-expired", (event) => {
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    if (kind === "user" || kind == null) {
      useUserAuthStore.setState({ user: null, isAuthenticated: false, error: useI18nStore.getState().t("errors.sessionExpired") });
    }
  });
}
