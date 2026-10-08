import { getActiveMap } from "./mapActions";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";
import { resolveAoi } from "./aoiCommands";

/** Commands are handled by the React module that owns the state. The assistant
 * never receives a DOM selector or an arbitrary callback to invoke. */
export interface UiCommand {
  action: string;
  target: string;
  parameters?: Record<string, unknown>;
  reason?: string;
  expected_state?: Record<string, unknown>;
}

export interface UiCommandOutcome {
  hasResult: boolean;
  error?: string | null;
}

export interface UiCommandHandler {
  read: () => Record<string, unknown>;
  execute: (command: UiCommand) => Promise<void | UiCommandOutcome> | void | UiCommandOutcome;
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
  if (namespace === "aoi") {
    if (command.action !== "select_aoi" || command.target !== "aoi.active")
      throw new Error("Perintah AOI tidak dikenal.");
    const state = await resolveAoi(command.parameters?.query);
    verifyExpected(command, state);
    return state;
  }
  if (namespace === "map") {
    const map = getActiveMap();
    if (!map) throw new Error("Peta belum tersedia pada layar.");
    if (command.action !== "set_map_view" || command.target !== "map.main")
      throw new Error("Perintah peta tidak dikenal.");
    const center = command.parameters?.center;
    const zoom = command.parameters?.zoom;
    if (
      !Array.isArray(center) ||
      center.length !== 2 ||
      !center.every((n) => typeof n === "number" && Number.isFinite(n)) ||
      center[0] < -90 ||
      center[0] > 90 ||
      center[1] < -180 ||
      center[1] > 180 ||
      typeof zoom !== "number" ||
      !Number.isFinite(zoom) ||
      zoom < map.getMinZoom() ||
      zoom > map.getMaxZoom()
    ) {
      throw new Error("Koordinat atau zoom peta tidak valid.");
    }
    map.setView(center as [number, number], zoom);
    const state = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() };
    verifyExpected(command, state);
    return state;
  }
  if (namespace === "navigation") {
    if (command.action !== "open_module" || command.target !== "navigation.module")
      throw new Error("Perintah navigasi tidak dikenal.");
    const module = command.parameters?.value;
    const allowed: DashboardModule[] = [
      "carbon",
      "lc-change",
      "imagery",
      "disaster",
      "crop-monitoring",
      "guide",
      "about",
    ];
    if (typeof module !== "string" || !allowed.some((item) => item === module))
      throw new Error("Modul tidak tersedia.");
    useUiStore.getState().setActiveModule(module as DashboardModule);
    window.history.pushState(null, "", getDashboardModulePath(module as DashboardModule));
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    const state = { module: useUiStore.getState().activeModule };
    verifyExpected(command, state);
    return state;
  }
  const moduleForNamespace: Record<string, DashboardModule> = {
    carbon: "carbon",
    lc_change: "lc-change",
    scenes: "imagery",
    crop: "crop-monitoring",
    disaster: "disaster",
  };
  if (!handlers.has(namespace) && moduleForNamespace[namespace]) {
    await executeUiCommand({
      action: "open_module",
      target: "navigation.module",
      parameters: { value: moduleForNamespace[namespace] },
    });
    const deadline = Date.now() + 8000;
    while (!handlers.has(namespace) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const handler = handlers.get(namespace);
  if (!handler) throw new Error(`Modul ${namespace} belum menyediakan kontrol chatbot.`);
  if (command.action === "set_provider") {
    const deadline = Date.now() + 10000;
    while (
      !(handlers.get(namespace)?.read().availableProviders as unknown[] | undefined)?.length &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const outcome = await (handlers.get(namespace) ?? handler).execute(command);
  // React batches state updates; let the owner commit before reading back.
  await new Promise((resolve) => setTimeout(resolve, 0));
  let state = handlers.get(namespace)?.read() ?? handler.read();
  // Setters must observe the committed React state before the next action uses
  // it. A fixed delay can read an old handler during a busy render.
  if (["set_parameter", "set_analysis_type", "set_provider", "set_date_range", "accordion", "select_field"].includes(command.action)) {
    const deadline = Date.now() + 1500;
    while (Object.entries(command.expected_state ?? {}).some(([key, expected]) => JSON.stringify(state[key]) !== JSON.stringify(expected)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      state = handlers.get(namespace)?.read() ?? handler.read();
    }
  }
  // The owner may return the actual API outcome before React commits its
  // result/error state. Never turn a successful request into a render-timing
  // failure, or report an old result after this request failed.
  if (command.action === "run_analysis" && outcome) state = { ...state, ...outcome };
  if (
    ["run_analysis", "search_scenes", "show_scene"].includes(command.action) &&
    typeof state.error === "string" &&
    state.error
  ) {
    throw new Error(state.error);
  }
  if (command.action === "run_analysis" && state.hasResult !== true) {
    throw new Error("Analisis selesai tanpa hasil yang dapat ditampilkan.");
  }
  if (
    command.action === "show_scene" &&
    command.parameters?.visible === true &&
    state.sceneVisible !== true
  ) {
    throw new Error("Scene tidak berhasil ditampilkan pada peta.");
  }
  verifyExpected(command, state);
  return state;
}
