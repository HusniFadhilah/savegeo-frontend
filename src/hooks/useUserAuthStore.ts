import { create } from "zustand";
import { ApiError } from "@/services/apiClient";
import {
  getStoredAppUser,
  setUserUnauthorizedHandler,
  userAuthService,
  type AppUser,
} from "@/services/userAuthService";

interface UserAuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

/**
 * Mirrors `hooks/useAuthStore.ts` exactly, for the separate public `users`
 * table. Registers its own 401 handler via `userAuthService`'s local
 * pub/sub (not `apiClient.ts`'s single global `setUnauthorizedHandler` slot,
 * which stays admin-only) - see `features/disaster/api.ts`'s doc comment for
 * the full rationale.
 */
export const useUserAuthStore = create<UserAuthState>((set) => ({
  user: getStoredAppUser(),
  isAuthenticated: userAuthService.isAuthenticated(),
  isLoading: false,
  error: null,
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await userAuthService.login(username, password);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : "Login gagal", isLoading: false });
      return false;
    }
  },
  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await userAuthService.register(username, email, password);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : "Registrasi gagal", isLoading: false });
      return false;
    }
  },
  logout: () => {
    userAuthService.logout();
    set({ user: null, isAuthenticated: false });
  },
}));

setUserUnauthorizedHandler(() => {
  useUserAuthStore.setState({ user: null, isAuthenticated: false, error: "Sesi berakhir, silakan login kembali" });
});

if (typeof window !== "undefined") {
  window.addEventListener("savegeo:app-auth-expired", (event) => {
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    if (kind === "user" || kind == null) {
      useUserAuthStore.setState({ user: null, isAuthenticated: false, error: "Sesi berakhir, silakan login kembali" });
    }
  });
}
