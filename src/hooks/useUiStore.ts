import { create } from "zustand";

// "details" (Detail Program Penelitian) merged into "about" (Tentang Program)
// - one page, tabbed, instead of two near-identical stacked-card pages.
export type DashboardModule = "carbon" | "lc-change" | "imagery" | "disaster" | "crop-monitoring" | "guide" | "about";

interface LoadingState {
  visible: boolean;
  text: string;
  subtext: string;
  progress: number;
  /** true = shrunk to a small corner pill so the rest of the app is usable
   * while the request keeps running in the background (the request itself
   * is unaffected either way - this only changes whether the full-screen
   * overlay div blocks clicks on the rest of the UI). */
  minimized: boolean;
}

interface UiState {
  activeModule: DashboardModule;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  loading: LoadingState;
  setActiveModule: (m: DashboardModule) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  showLoading: (text?: string, subtext?: string) => void;
  setLoadingProgress: (progress: number, subtext?: string) => void;
  hideLoading: () => void;
  minimizeLoading: () => void;
  restoreLoading: () => void;
}

const STORAGE_MODULE = "currentModule";
const STORAGE_SIDEBAR = "sidebarCollapsed";

function readInitialModule(): DashboardModule {
  const saved = localStorage.getItem(STORAGE_MODULE);
  const valid: DashboardModule[] = ["carbon", "lc-change", "imagery", "disaster", "crop-monitoring", "guide", "about"];
  return (valid as string[]).includes(saved || "") ? (saved as DashboardModule) : "carbon";
}

export const useUiStore = create<UiState>((set) => ({
  activeModule: readInitialModule(),
  sidebarCollapsed: localStorage.getItem(STORAGE_SIDEBAR) !== "false",
  mobileSidebarOpen: false,
  loading: { visible: false, text: "Memproses data...", subtext: "Mohon tunggu", progress: 0, minimized: false },
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
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  showLoading: (text = "Memproses data...", subtext = "Mohon tunggu") =>
    set({ loading: { visible: true, text, subtext, progress: 0, minimized: false } }),
  setLoadingProgress: (progress, subtext) =>
    set((s) => ({ loading: { ...s.loading, progress, subtext: subtext ?? s.loading.subtext } })),
  hideLoading: () => set((s) => ({ loading: { ...s.loading, visible: false, progress: 0, minimized: false } })),
  minimizeLoading: () => set((s) => ({ loading: { ...s.loading, minimized: true } })),
  restoreLoading: () => set((s) => ({ loading: { ...s.loading, minimized: false } })),
}));
