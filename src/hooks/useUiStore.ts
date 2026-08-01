import { create } from "zustand";

export type DashboardModule = "carbon" | "lc-change" | "disaster" | "guide" | "about" | "details";

interface LoadingState {
  visible: boolean;
  text: string;
  subtext: string;
  progress: number;
}

interface UiState {
  activeModule: DashboardModule;
  sidebarCollapsed: boolean;
  loading: LoadingState;
  setActiveModule: (m: DashboardModule) => void;
  toggleSidebar: () => void;
  showLoading: (text?: string, subtext?: string) => void;
  setLoadingProgress: (progress: number, subtext?: string) => void;
  hideLoading: () => void;
}

const STORAGE_MODULE = "currentModule";
const STORAGE_SIDEBAR = "sidebarCollapsed";

function readInitialModule(): DashboardModule {
  const saved = localStorage.getItem(STORAGE_MODULE);
  const valid: DashboardModule[] = ["carbon", "lc-change", "disaster", "guide", "about", "details"];
  return (valid as string[]).includes(saved || "") ? (saved as DashboardModule) : "carbon";
}

export const useUiStore = create<UiState>((set) => ({
  activeModule: readInitialModule(),
  sidebarCollapsed: localStorage.getItem(STORAGE_SIDEBAR) !== "false",
  loading: { visible: false, text: "Memproses data...", subtext: "Mohon tunggu", progress: 0 },
  setActiveModule: (m) => {
    localStorage.setItem(STORAGE_MODULE, m);
    set({ activeModule: m });
  },
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      localStorage.setItem(STORAGE_SIDEBAR, String(next));
      return { sidebarCollapsed: next };
    }),
  showLoading: (text = "Memproses data...", subtext = "Mohon tunggu") =>
    set({ loading: { visible: true, text, subtext, progress: 0 } }),
  setLoadingProgress: (progress, subtext) =>
    set((s) => ({ loading: { ...s.loading, progress, subtext: subtext ?? s.loading.subtext } })),
  hideLoading: () => set((s) => ({ loading: { ...s.loading, visible: false, progress: 0 } })),
}));
