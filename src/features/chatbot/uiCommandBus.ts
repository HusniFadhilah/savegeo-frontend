import { getActiveMap } from "./mapActions";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";

/** Commands are handled by the React module that owns the state. The assistant
 * never receives a DOM selector or an arbitrary callback to invoke. */
export interface UiCommand {
  action: string;
  target: string;
  parameters?: Record<string, unknown>;
  reason?: string;
  expected_state?: Record<string, unknown>;
}

export interface UiCommandHandler {
  read: () => Record<string, unknown>;
  execute: (command: UiCommand) => Promise<void> | void;
}

const handlers = new Map<string, UiCommandHandler>();

function verifyExpected(command: UiCommand, state: Record<string, unknown>): void {
  for (const [key, expected] of Object.entries(command.expected_state ?? {})) {
    if (JSON.stringify(state[key]) !== JSON.stringify(expected)) {
      throw new Error(`Perintah ${command.action} belum menghasilkan state ${key} yang diminta.`);
    }
  }
}

export function registerUiCommands(namespace: string, handler: UiCommandHandler): () => void {
  handlers.set(namespace, handler);
  return () => {
    if (handlers.get(namespace) === handler) handlers.delete(namespace);
  };
}

export function readUiCommandState(namespace: string): Record<string, unknown> | null {
  return handlers.get(namespace)?.read() ?? null;
}

export async function executeUiCommand(command: UiCommand): Promise<Record<string, unknown>> {
  if (!command || typeof command.action !== "string" || typeof command.target !== "string") {
    throw new Error("Format perintah UI tidak valid.");
  }
  const namespace = command.target.split(".")[0];
  if (namespace === "map") {
    const map = getActiveMap();
    if (!map) throw new Error("Peta belum tersedia pada layar.");
    if (command.action !== "set_map_view" || command.target !== "map.main") throw new Error("Perintah peta tidak dikenal.");
    const center = command.parameters?.center;
    const zoom = command.parameters?.zoom;
    if (!Array.isArray(center) || center.length !== 2 || !center.every((n) => typeof n === "number" && Number.isFinite(n)) ||
      center[0] < -90 || center[0] > 90 || center[1] < -180 || center[1] > 180 ||
      typeof zoom !== "number" || !Number.isFinite(zoom) || zoom < map.getMinZoom() || zoom > map.getMaxZoom()) {
      throw new Error("Koordinat atau zoom peta tidak valid.");
    }
    map.setView(center as [number, number], zoom);
    const state = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() };
    verifyExpected(command, state);
    return state;
  }
  if (namespace === "navigation") {
    if (command.action !== "open_module" || command.target !== "navigation.module") throw new Error("Perintah navigasi tidak dikenal.");
    const module = command.parameters?.value;
    const allowed: DashboardModule[] = ["carbon", "lc-change", "imagery", "disaster", "crop-monitoring", "guide", "about"];
    if (typeof module !== "string" || !allowed.some((item) => item === module)) throw new Error("Modul tidak tersedia.");
    useUiStore.getState().setActiveModule(module as DashboardModule);
    window.history.pushState(null, "", getDashboardModulePath(module as DashboardModule));
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    const state = { module: useUiStore.getState().activeModule };
    verifyExpected(command, state);
    return state;
  }
  const handler = handlers.get(namespace);
  if (!handler) throw new Error(`Modul ${namespace} belum menyediakan kontrol chatbot.`);
  await handler.execute(command);
  // React batches state updates; let the owner commit before reading back.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const state = handlers.get(namespace)?.read() ?? handler.read();
  if (["run_analysis", "search_scenes", "show_scene"].includes(command.action) && typeof state.error === "string" && state.error) {
    throw new Error(state.error);
  }
  if (command.action === "run_analysis" && state.hasResult !== true) {
    throw new Error("Analisis selesai tanpa hasil yang dapat ditampilkan.");
  }
  if (command.action === "show_scene" && command.parameters?.visible === true && state.sceneVisible !== true) {
    throw new Error("Scene tidak berhasil ditampilkan pada peta.");
  }
  verifyExpected(command, state);
  return state;
}
