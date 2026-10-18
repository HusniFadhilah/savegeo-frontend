import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";

/** Modules the assistant may open. Mirrors the backend `open_module` enum. */
export const ASSISTANT_MODULES: readonly DashboardModule[] = [
  "carbon",
  "lc-change",
  "imagery",
  "disaster",
  "crop-monitoring",
  "guide",
  "about",
];

export function isAssistantModule(value: unknown): value is DashboardModule {
  return typeof value === "string" && (ASSISTANT_MODULES as readonly string[]).includes(value);
}

/** The single way the assistant changes the dashboard module (store + URL). */
export function openDashboardModule(module: DashboardModule): void {
  useUiStore.getState().setActiveModule(module);
  window.history.pushState(null, "", getDashboardModulePath(module));
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}
