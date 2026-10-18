import { setMapView } from "./mapActions";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { confirmActiveAoi, resolveAoi } from "./aoiCommands";
import { isAssistantModule, openDashboardModule } from "./navigation";

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
const handlerListeners = new Set<() => void>();

function mismatchedKeys(command: UiCommand, state: Record<string, unknown>): string[] {
  return Object.entries(command.expected_state ?? {})
    .filter(([key, expected]) => JSON.stringify(state[key]) !== JSON.stringify(expected))
    .map(([key]) => key);
}

function verifyExpected(command: UiCommand, state: Record<string, unknown>): void {
  const [first] = mismatchedKeys(command, state);
  if (first) {
    throw new Error(`Perintah ${command.action} belum menghasilkan state ${first} yang diminta.`);
  }
}

export function registerUiCommands(namespace: string, handler: UiCommandHandler): () => void {
  handlers.set(namespace, handler);
  handlerListeners.forEach((listener) => listener());
  return () => {
    if (handlers.get(namespace) === handler) handlers.delete(namespace);
  };
}

export function readUiCommandState(namespace: string): Record<string, unknown> | null {
  return handlers.get(namespace)?.read() ?? null;
}

/** Resolves when `namespace` registers (immediately if it already has), or false after `timeoutMs`. */
function waitForHandler(namespace: string, timeoutMs: number): Promise<boolean> {
  if (handlers.has(namespace)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      handlerListeners.delete(listener);
      resolve(ok);
    };
    const listener = () => {
      if (handlers.has(namespace)) finish(true);
    };
    const timer = setTimeout(() => finish(handlers.has(namespace)), timeoutMs);
    handlerListeners.add(listener);
  });
}

const tick = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves after React has rendered and run effects for state set just before this call. */
function commitBarrier(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 16);
    }
  });
}

const MODULE_FOR_NAMESPACE: Record<string, DashboardModule> = {
  carbon: "carbon",
  lc_change: "lc-change",
  scenes: "imagery",
  crop: "crop-monitoring",
  disaster: "disaster",
};

export async function executeUiCommand(command: UiCommand): Promise<Record<string, unknown>> {
  if (!command || typeof command.action !== "string" || typeof command.target !== "string") {
    throw new Error("Format perintah UI tidak valid.");
  }
  const namespace = command.target.split(".")[0];

  if (namespace === "aoi") {
    if (command.target !== "aoi.active") throw new Error("Perintah AOI tidak dikenal.");
    let state: Record<string, unknown>;
    if (command.action === "select_aoi") state = await resolveAoi(command.parameters?.query);
    else if (command.action === "use_active_aoi") state = await confirmActiveAoi();
    else throw new Error("Perintah AOI tidak dikenal.");
    // Modules follow the AOI store through effects; later steps (search, analysis)
    // must not run against their previous AOI.
    await commitBarrier();
    verifyExpected(command, state);
    return state;
  }

  if (namespace === "map") {
    if (command.action !== "set_map_view" || command.target !== "map.main") {
      throw new Error("Perintah peta tidak dikenal.");
    }
    const state = setMapView(command.parameters?.center, command.parameters?.zoom);
    verifyExpected(command, state);
    return state;
  }

  if (namespace === "navigation") {
    if (command.action !== "open_module" || command.target !== "navigation.module") {
      throw new Error("Perintah navigasi tidak dikenal.");
    }
    const module = command.parameters?.value;
    if (!isAssistantModule(module)) throw new Error("Modul tidak tersedia.");
    openDashboardModule(module);
    const state = { module: useUiStore.getState().activeModule };
    verifyExpected(command, state);
    return state;
  }

  if (!handlers.has(namespace) && MODULE_FOR_NAMESPACE[namespace]) {
    openDashboardModule(MODULE_FOR_NAMESPACE[namespace]);
    await waitForHandler(namespace, 8000);
  }
  const handler = handlers.get(namespace);
  if (!handler) throw new Error(`Modul ${namespace} belum menyediakan kontrol chatbot.`);
  if (command.action === "set_provider") {
    const deadline = Date.now() + 10000;
    while (
      !(handlers.get(namespace)?.read().availableProviders as unknown[] | undefined)?.length &&
      Date.now() < deadline
    ) {
      await tick(50);
    }
  }
  const outcome = await (handlers.get(namespace) ?? handler).execute(command);
  // React batches state updates; let the owner commit before reading back.
  await tick(0);
  let state = handlers.get(namespace)?.read() ?? handler.read();
  // A setter must be observable before the next action builds on it. Poll only
  // while the owner still disagrees with the state this command asked for.
  // run_analysis reports its own outcome below, so it is not polled.
  const deadline = Date.now() + (command.action === "run_analysis" ? 0 : 1500);
  while (mismatchedKeys(command, state).length > 0 && Date.now() < deadline) {
    await tick(25);
    state = handlers.get(namespace)?.read() ?? handler.read();
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
