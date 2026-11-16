import { create } from "zustand";
import type { AdminUser, MfaLoginChallenge } from "@/types/api";
import { authService } from "@/services/authService";
import { ApiError, setUnauthorizedHandler } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useViewerFeatures } from "@/hooks/useViewerFeatures";

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaChallenge: MfaLoginChallenge | null;
  recoveryCodes: string[];
  verifyMfa: (code: string) => Promise<boolean>;
  finishMfa: () => Promise<void>;
  cancelMfa: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  mfaChallenge: null,
  recoveryCodes: [],
  login: async (username, password) => {
    useViewerFeatures.getState().reset();
    set({ isLoading: true, error: null, mfaChallenge: null, recoveryCodes: [] });
    try {
      const result = await authService.login(username, password);
      if ("mfa_required" in result && result.mfa_required) {
        set({ mfaChallenge: result, user: null, isAuthenticated: false, isLoading: false });
        return false;
      }
      // Verify the HttpOnly cookie before redirecting. This catches a
      // wrong API host/CORS origin immediately instead of showing /admin and
      // then silently falling back to the admin login screen.
      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message.toLowerCase() : "";
      const status = err instanceof ApiError ? err.status : 0;
      const key =
        status === 401 ||
        raw.includes("invalid username") ||
        raw.includes("invalid credentials") ||
        raw.includes("incorrect username")
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
  verifyMfa: async (code) => {
    const challenge = get().mfaChallenge;
    if (!challenge || get().isLoading) return false;
    set({ isLoading: true, error: null });
    try {
      const result = await authService.verifyMfa(challenge.challenge, code);
      if (result.recovery_codes.length > 0) {
        set({ recoveryCodes: result.recovery_codes, mfaChallenge: null, isLoading: false });
      } else {
        await get().finishMfa();
      }
      return true;
    } catch (cause) {
      set({
        isLoading: false,
        error: cause instanceof Error ? cause.message : "Verifikasi MFA gagal.",
      });
      return false;
    }
  },
  finishMfa: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false, mfaChallenge: null, recoveryCodes: [] });
    } catch (cause) {
      set({
        isLoading: false,
        error: cause instanceof Error ? cause.message : "Sesi MFA tidak tersedia.",
      });
    }
  },
  cancelMfa: () => {
    if (get().recoveryCodes.length > 0) return;
    set({ mfaChallenge: null, error: null, isLoading: false });
  },
  logout: async () => {
    try {
      await authService.logout();
    } catch {
      set({ error: useI18nStore.getState().t("auth.logoutFailed") });
      return false;
    }
    useViewerFeatures.getState().reset();
    window.dispatchEvent(new Event("savegeo:logout"));
    set({ user: null, isAuthenticated: false, error: null, mfaChallenge: null, recoveryCodes: [] });
    return true;
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
  useViewerFeatures.getState().reset();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    error: useI18nStore.getState().t("errors.sessionExpired"),
  });
});

if (typeof window !== "undefined") {
  window.addEventListener("savegeo:app-auth-expired", (event) => {
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    if (kind === "admin" || kind == null) {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        error: useI18nStore.getState().t("errors.sessionExpired"),
      });
    }
  });
}
