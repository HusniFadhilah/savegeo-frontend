import { create } from "zustand";
import type { AdminUser } from "@/types/api";
import { authService } from "@/services/authService";
import { ApiError, setUnauthorizedHandler } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      await authService.login(username, password);
      // Verify the HttpOnly cookie before redirecting. This catches a
      // wrong API host/CORS origin immediately instead of showing /admin and
      // then silently falling back to the admin login screen.
      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message.toLowerCase() : "";
      const status = err instanceof ApiError ? err.status : 0;
      const key = status === 401 || raw.includes("invalid username") || raw.includes("invalid credentials") || raw.includes("incorrect username")
        ? "auth.invalidCredentials"
        : raw.includes("bearer") || raw.includes("401")
          ? "errors.authRequired"
          : raw.includes("network") || raw.includes("fetch")
            ? "errors.serverUnavailable"
            : "auth.loginFailed";
      set({ error: useI18nStore.getState().t(key), isLoading: false });
      return false;
    }
  },
  logout: () => {
    void authService.logout();
    set({ user: null, isAuthenticated: false });
  },
  initialize: async () => {
    try {
      const user = await authService.me();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

void useAuthStore.getState().initialize();

setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, error: useI18nStore.getState().t("errors.sessionExpired") });
});

if (typeof window !== "undefined") {
  window.addEventListener("savegeo:app-auth-expired", (event) => {
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    if (kind === "admin" || kind == null) {
      useAuthStore.setState({ user: null, isAuthenticated: false, error: useI18nStore.getState().t("errors.sessionExpired") });
    }
  });
}
