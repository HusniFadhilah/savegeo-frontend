import { create } from "zustand";
import type { AdminUser } from "@/types/api";
import { authService, getStoredUser } from "@/services/authService";
import { setUnauthorizedHandler } from "@/services/apiClient";

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(username, password);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Login gagal", isLoading: false });
      return false;
    }
  },
  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },
}));

setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, error: "Sesi berakhir, silakan login kembali" });
});

if (typeof window !== "undefined") {
  window.addEventListener("savegeo:app-auth-expired", (event) => {
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    if (kind === "admin" || kind == null) {
      useAuthStore.setState({ user: null, isAuthenticated: false, error: "Sesi berakhir, silakan login kembali" });
    }
  });
}
