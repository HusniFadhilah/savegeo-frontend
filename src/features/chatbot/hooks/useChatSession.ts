import { useEffect, useRef, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { ChatSession } from "@/types/api";
import { chatbotApi } from "../api";
import { runActions, type ActionRunContext } from "../actionExecutor";
import { CHAT_I18N } from "../i18n";
import { buildSuggestedPrompts } from "../suggestedPrompts";
import { captureMapScreenshot, getAppValue, getPageState, buildGeoAiContext } from "../windowBridge";
import {
  aoiFeatureFromGeoJSON,
  aoiNameFromGeoJSON,
  formatFileSize,
  iconForMime,
  isValidAoiGeoJSON,
  parseKmlToGeoJSON,
  readFileAsDataUrl,
  readFileAsText,
  stripDataUrlPrefix,
  TEXT_MIME_TYPES,
} from "../utils/fileHandling";
import type {
  AgentControlResponse,
  ChatAction,
  ChatWarning,
  GeoAiContext,
  LogEntry,
  PendingFileAttachment,
  QuickAction,
  ResultCard,
} from "../types";

export const DEFAULT_FILE_ACCEPT = "image/*,.pdf,.txt,.csv,.json,.geojson,.kml,.md,.docx,.zip,.shp";
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".csv", ".json", ".geojson", ".kml", ".md", ".docx", ".zip", ".shp"];
const DEFAULT_MAX_FILE_MB = 5;
const DEFAULT_STATUS = "Siap membantu analisis";

let idSeq = 0;
function makeId(prefix: string): string {
  idSeq += 1;
  return `sgc-${prefix}-${Date.now()}-${idSeq}`;
}

function isAllowedFile(file: File): boolean {
  if ((file.type || "").startsWith("image/")) return true;
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function normalizeWarnings(warnings: (string | ChatWarning)[] | undefined): string[] {
  return (warnings || []).map((w) => (typeof w === "string" ? w : w.message || JSON.stringify(w)));
}

export function useChatSession() {
  const language = useI18nStore((s) => s.language);

  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [quickActionsVisible, setQuickActionsVisible] = useState(true);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFileAttachment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [maxFileMb, setMaxFileMb] = useState(DEFAULT_MAX_FILE_MB);
  const [fileInputAccept, setFileInputAccept] = useState(DEFAULT_FILE_ACCEPT);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionId, setSessionIdState] = useState<number | null>(null);

  const isOpenRef = useRef(isOpen);
  const isLoadingRef = useRef(isLoading);
  const sessionIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Set right before an intentional abort-and-immediately-retry, so the AbortError handler in
   *  callBackend knows to skip showing a "Permintaan dibatalkan" retry chip for this one. */
  const suppressAbortChipRef = useRef(false);
  /** hotspot id -> geometry from the most recent geoai response's hotspot cards, so
   *  highlight_hotspot/show_before_after actions (and follow-up turns) can resolve them. */
  const hotspotGeometriesRef = useRef<Record<string, GeoJSON.Geometry>>({});

  isOpenRef.current = isOpen;
  isLoadingRef.current = isLoading;

  function setSessionId(id: number | null) {
    sessionIdRef.current = id;
    setSessionIdState(id);
  }

  function t() {
    return CHAT_I18N[language] || CHAT_I18N.id;
  }

  /* ── Log entry helpers ─────────────────────────────────────────── */
  function appendEntry(entry: LogEntry): string {
    setLog((prev) => [...prev, entry]);
    return entry.id;
  }
  function removeEntry(id: string) {
    setLog((prev) => prev.filter((e) => e.id !== id));
  }
  function appendMessage(role: "user" | "assistant", text: string, extra?: Partial<LogEntry>) {
    appendEntry({ id: makeId("msg"), kind: "message", role, text, ...extra } as LogEntry);
  }
  function updateConfirmCard(
    id: string,
    patch: Partial<Extract<LogEntry, { kind: "confirmCard" }>>,
  ) {
    setLog((prev) =>
      prev.map((e) => (e.id === id && e.kind === "confirmCard" ? { ...e, ...patch } : e)),
    );
  }
  function updateChoiceCard(
    id: string,
    patch: Partial<Extract<LogEntry, { kind: "choiceCard" }>>,
  ) {
    setLog((prev) =>
      prev.map((e) => (e.id === id && e.kind === "choiceCard" ? { ...e, ...patch } : e)),
    );
  }
  function updateAoiOffer(id: string, patch: Partial<Extract<LogEntry, { kind: "aoiOffer" }>>) {
    setLog((prev) => prev.map((e) => (e.id === id && e.kind === "aoiOffer" ? { ...e, ...patch } : e)));
  }

  function resetToWelcome() {
    setLog([{ id: makeId("msg"), kind: "message", role: "assistant", text: t().welcome }]);
    setQuickActionsVisible(true);
  }

  /* ── Init ─────────────────────────────────────────────────────── */
  useEffect(() => {
    resetToWelcome();
    fetchLimits();
    fetchSessions();
    // Run once on mount only - a language switch mid-session should not
    // retroactively rewrite already-sent messages (same as the original).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLimits() {
    const cfg = await chatbotApi.fetchPublicConfig();
    const raw = cfg["ai.rate_limit_max_file_mb"];
    if (raw != null) {
      const parsed = parseFloat(String(raw));
      if (!isNaN(parsed)) setMaxFileMb(parsed);
    }
  }

  async function fetchSessions() {
    const list = await chatbotApi.fetchSessions();
    setSessions(list);
  }

  /* ── Panel / open-close ──────────────────────────────────────── */
  function open() {
    setIsOpen(true);
    setHasUnread(false);
  }
  function close() {
    setIsOpen(false);
  }
  function toggle() {
    if (isOpen) close();
    else open();
  }
  function toggleSessionPanel() {
    setSessionPanelOpen((prev) => {
      const next = !prev;
      if (next) fetchSessions();
      return next;
    });
  }

  async function openSession(id: number) {
    const data = await chatbotApi.fetchSession(id);
    if (!data) return;
    setSessionId(id);
    const newLog: LogEntry[] = [];
    (data.messages || []).forEach((m) => {
      if (m.role === "assistant") {
        let parsed: AgentControlResponse | null = null;
        try {
          parsed = JSON.parse(m.content);
        } catch {
          parsed = null;
        }
        if (parsed && typeof parsed.message !== "undefined") {
          if (parsed.message) {
            newLog.push({ id: makeId("msg"), kind: "message", role: "assistant", text: parsed.message });
          }
          const warnings = normalizeWarnings(parsed.warnings);
          if (warnings.length) newLog.push({ id: makeId("warn"), kind: "warnings", warnings });
          if (parsed.cards?.length) {
            registerHotspotCards(parsed.cards);
            parsed.cards.forEach((card) => newLog.push({ id: makeId("card"), kind: "resultCard", card }));
          }
          if (parsed.actions?.length) {
            newLog.push({
              id: makeId("hist"),
              kind: "actionHistory",
              actions: parsed.actions,
              timestamp: m.created_at,
            });
          }
        } else {
          // Backward compat: plain-text assistant message from before the
          // structured {message, actions, warnings} response shape existed.
          newLog.push({ id: makeId("msg"), kind: "message", role: "assistant", text: m.content });
        }
      } else {
        newLog.push({ id: makeId("msg"), kind: "message", role: "user", text: m.content });
      }
    });
    setLog(newLog);
    setQuickActionsVisible(false);
    setSessionPanelOpen(false);
  }

  async function deleteSession(id: number) {
    const ok = await chatbotApi.deleteSession(id);
    if (!ok) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (sessionIdRef.current === id) {
      setSessionId(null);
      resetToWelcome();
    }
  }

  async function renameSession(id: number, title: string): Promise<boolean> {
    const trimmed = title.trim().slice(0, 120);
    if (!trimmed) return false;
    const ok = await chatbotApi.renameSession(id, trimmed);
    if (ok) setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    return ok;
  }

  function newChat() {
    setSessionId(null);
    resetToWelcome();
    clearPendingImage();
    clearPendingFile();
    hotspotGeometriesRef.current = {};
    if (sessionPanelOpen) setSessionPanelOpen(false);
  }

  /* ── Pending attachments ─────────────────────────────────────── */
  function clearPendingImage() {
    setPendingImage(null);
  }
  function clearPendingFile() {
    setPendingFile(null);
  }

  async function handleCameraClick() {
    if (cameraBusy) return;
    setCameraBusy(true);
    setStatus("Mengambil screenshot peta...");
    try {
      const b64 = await captureMapScreenshot();
      setPendingImage(b64);
      setStatus("Screenshot siap — kirim pesan atau tekan Kirim");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendMessage("assistant", `Gagal mengambil screenshot: ${msg}`);
      setStatus(DEFAULT_STATUS);
    } finally {
      setCameraBusy(false);
    }
  }

  function offerGeoJSONAsAOI(geo: GeoJSON.GeoJSON, fileName: string, rawText: string, sizeLabel: string) {
    const name = aoiNameFromGeoJSON(geo, fileName);
    appendEntry({
      id: makeId("aoi"),
      kind: "aoiOffer",
      geo,
      rawText,
      fileName,
      name,
      sizeLabel,
      resolved: false,
    });
  }

  async function handleFileSelected(file: File) {
    const maxBytes = maxFileMb * 1024 * 1024;
    if (file.size > maxBytes) {
      appendMessage(
        "assistant",
        `File terlalu besar (${(file.size / 1048576).toFixed(1)} MB). Maks ${maxFileMb} MB.`,
      );
      return;
    }
    if (!isAllowedFile(file)) {
      appendMessage(
        "assistant",
        `Tipe file "${file.name}" tidak didukung. Gunakan gambar, PDF, TXT, CSV, JSON, GeoJSON, KML, MD, DOCX, atau ZIP/SHP.`,
      );
      return;
    }

    const mime = file.type || "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isText = TEXT_MIME_TYPES.includes(mime);
    const fname = file.name.toLowerCase();
    const sizeLabel = formatFileSize(file.size);

    if (isImage) {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingImage(stripDataUrlPrefix(dataUrl));
      setStatus("Gambar siap dikirim");
      return;
    }

    const icon = iconForMime(mime);
    const isZipSHP = fname.endsWith(".zip") || fname.endsWith(".shp");
    if (isZipSHP) {
      setStatus("Mengkonversi shapefile...");
      appendMessage("assistant", "Memproses shapefile, harap tunggu...");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const d = await chatbotApi.convertShp(stripDataUrlPrefix(dataUrl), file.name);
        if (d.error) {
          appendMessage("assistant", `Gagal konversi SHP: ${d.error}`);
        } else {
          appendMessage("assistant", `Shapefile berhasil dikonversi (${d.feature_count} feature).`);
          offerGeoJSONAsAOI(d.geojson, d.name || file.name, JSON.stringify(d.geojson), sizeLabel);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendMessage("assistant", `Gagal mengirim shapefile: ${msg}`);
      } finally {
        setStatus(DEFAULT_STATUS);
      }
      return;
    }

    const isKML = fname.endsWith(".kml");
    if (isKML) {
      const text = await readFileAsText(file);
      const geo = parseKmlToGeoJSON(text);
      if (geo) {
        offerGeoJSONAsAOI(geo, file.name.replace(/\.kml$/i, ""), JSON.stringify(geo), sizeLabel);
      } else {
        appendMessage(
          "assistant",
          "KML tidak dapat diparsing sebagai polygon AOI. Coba konversi ke GeoJSON terlebih dahulu.",
        );
      }
      return;
    }

    const isGeoJSON =
      fname.endsWith(".geojson") ||
      (fname.endsWith(".json") && (mime === "application/json" || mime === "application/geo+json"));

    if (isText || isGeoJSON) {
      const text = await readFileAsText(file);
      if (isGeoJSON) {
        try {
          const geo = JSON.parse(text);
          if (isValidAoiGeoJSON(geo)) {
            offerGeoJSONAsAOI(geo, file.name, text, sizeLabel);
            return;
          }
        } catch {
          // Not valid JSON - fall through and attach as a plain text file.
        }
      }
      setPendingFile({ name: file.name, mime_type: mime, size_label: sizeLabel, icon, text });
      setStatus("File teks siap dikirim");
      return;
    }

    // Binary (PDF, DOCX, ...) -> base64 attachment.
    const dataUrl = await readFileAsDataUrl(file);
    setPendingFile({
      name: file.name,
      mime_type: mime,
      size_label: sizeLabel,
      icon,
      b64: stripDataUrlPrefix(dataUrl),
    });
    setStatus("File siap dikirim");
  }

  function resolveAoiOffer(entryId: string, choice: "set" | "send") {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "aoiOffer") return;

    if (choice === "set") {
      const feature = aoiFeatureFromGeoJSON(entry.geo, entry.name);
      const setAOIFromGeoJSON = getAppValue("setAOIFromGeoJSON");
      const loadGeoJSONAsAOI = getAppValue("loadGeoJSONAsAOI");
      if (typeof setAOIFromGeoJSON === "function") {
        setAOIFromGeoJSON(feature, entry.name);
        appendMessage(
          "assistant",
          `✅ AOI **${entry.name}** berhasil diset dari file GeoJSON. Wilayah ditampilkan di peta.`,
        );
      } else if (typeof loadGeoJSONAsAOI === "function") {
        loadGeoJSONAsAOI(feature);
        appendMessage("assistant", `✅ AOI dari file **${entry.fileName}** telah diset.`);
      } else {
        appendMessage(
          "assistant",
          "⚠️ Fungsi set AOI belum tersedia di modul peta saat ini. Coba gambar AOI manual di peta.",
        );
      }
    } else {
      setPendingFile({
        name: entry.fileName,
        mime_type: "application/json",
        size_label: entry.sizeLabel,
        icon: "bi-map",
        text: entry.rawText,
      });
    }
    updateAoiOffer(entryId, { resolved: true });
  }

  /* ── Choice card ──────────────────────────────────────────────── */
  function selectChoice(entryId: string, index: number) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "choiceCard" || entry.selectedIndex !== null) return;
    updateChoiceCard(entryId, { selectedIndex: index });
    const choice = entry.choices[index];
    if (choice) sendMessage(choice.msg, { prefill: true });
  }

  /* ── Retry chip ───────────────────────────────────────────────── */
  function retryFromChip(entryId: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "retryChip") return;
    removeEntry(entryId);
    callBackend(entry.message, entry.image, entry.file);
  }

  function appendRetryChip(
    message: string,
    image: string | null,
    file: PendingFileAttachment | null,
    cancelNote?: string,
  ) {
    appendEntry({ id: makeId("retry"), kind: "retryChip", message, image, file, cancelNote });
  }

  /* ── Sending messages / backend call ─────────────────────────── */
  function sendMessage(rawText: string | undefined, opts?: { prefill?: boolean }) {
    const isPrefill = !!opts?.prefill;
    const typed = (rawText || "").trim();
    const image = isPrefill ? null : pendingImage;
    const file = isPrefill ? null : pendingFile;

    if (!typed && !image && !file) return;
    if (isLoadingRef.current) return;

    const defaultCaption = image ? "Tolong analisis screenshot peta ini." : file ? "Tolong analisis file ini." : "";
    const finalText = typed || defaultCaption;

    appendMessage("user", finalText, {
      image: image || null,
      file: file ? { name: file.name, size_label: file.size_label, icon: file.icon } : null,
    });
    setQuickActionsVisible(false);
    if (image) clearPendingImage();
    if (file) clearPendingFile();
    callBackend(finalText, image, file);
  }

  async function callBackend(message: string, image: string | null, file: PendingFileAttachment | null) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setStatus("Menghubungi AI...");
    const loadingId = makeId("loading");
    appendEntry({ id: loadingId, kind: "loading", startedAt: Date.now(), message, image, file });

    try {
      const resp = await chatbotApi.sendAgentControl({
        message,
        pageState: getPageState(),
        mode: "geoai",
        context: buildGeoAiContext(),
        imageB64: image,
        attachment: file,
        sessionId: sessionIdRef.current,
        signal: controller.signal,
      });
      removeEntry(loadingId);

      if (resp.session_id) {
        const isNew = !sessionIdRef.current;
        setSessionId(resp.session_id);
        if (isNew) fetchSessions();
      }

      if (resp.intent === "rate_limited") {
        appendMessage("assistant", `⚠️ ${resp.message || "Rate limit tercapai."}`);
        return;
      }
      handleResponse(resp);
    } catch (err) {
      removeEntry(loadingId);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (suppressAbortChipRef.current) {
          suppressAbortChipRef.current = false;
        } else {
          appendRetryChip(message, image, file, "Permintaan dibatalkan.");
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        appendMessage("assistant", `Maaf, terjadi kesalahan: ${msg}. Coba lagi.`);
        appendRetryChip(message, image, file);
      }
    } finally {
      setIsLoading(false);
      setStatus(DEFAULT_STATUS);
      if (!isOpenRef.current) setHasUnread(true);
    }
  }

  function cancelLoading() {
    abortControllerRef.current?.abort();
  }

  /** Inline 30s-slow "Coba Lagi" on the loading bubble itself: abort + immediately resend. */
  function retryLoadingNow(message: string, image: string | null, file: PendingFileAttachment | null) {
    suppressAbortChipRef.current = true;
    abortControllerRef.current?.abort();
    void callBackend(message, image, file);
  }

  function registerHotspotCards(cards: ResultCard[]) {
    for (const card of cards) {
      if (card.type === "hotspot") hotspotGeometriesRef.current[card.id] = card.geometry;
    }
  }

  function handleResponse(resp: AgentControlResponse) {
    if (resp.plan && !resp.actions) {
      handleLegacyResponse(resp);
      return;
    }

    const msg = resp.message || "";
    const warnings = normalizeWarnings(resp.warnings);
    const actions = resp.actions || [];
    const cards = resp.cards || [];

    if (msg) appendMessage("assistant", msg);
    if (warnings.length) appendEntry({ id: makeId("warn"), kind: "warnings", warnings });
    if (cards.length) {
      registerHotspotCards(cards);
      cards.forEach((card) => appendEntry({ id: makeId("card"), kind: "resultCard", card }));
    }

    actions
      .filter((a) => a.type === "ask_user")
      .forEach((a) => appendMessage("assistant", a.question || ""));

    const execActions = actions.filter((a) => a.type !== "ask_user" && a.type !== "explain");

    if (execActions.length === 0) {
      setQuickActionsVisible(true);
      return;
    }

    if (resp.needs_confirmation) {
      appendEntry({ id: makeId("confirm"), kind: "confirmCard", actions: execActions, status: "pending" });
    } else {
      void executeActionQueue(execActions);
    }
  }

  function handleLegacyResponse(resp: AgentControlResponse) {
    const plan = resp.plan || {};
    const guidance = plan.user_guidance || {};
    const mainText = guidance.plain_language || plan.message || "";
    if (mainText) appendMessage("assistant", mainText);
    const warnings = normalizeWarnings(plan.warnings);
    if (warnings.length) appendEntry({ id: makeId("warn"), kind: "warnings", warnings });
    if (resp.execution?.executed && resp.execution.report?.audience_summary) {
      appendMessage("assistant", resp.execution.report.audience_summary);
    }
    setQuickActionsVisible(true);
  }

  async function narrateResults(analysisTypes: string[]) {
    const typeLabel = analysisTypes.join(", ") || "analisis";
    const sysMsg =
      `Analisis ${typeLabel} telah selesai dijalankan. Tolong ringkas dan jelaskan hasil analisis yang ` +
      "sudah tersedia: angka estimasi utama, satuan, interpretasi kondisi area, keterbatasan dataset yang " +
      "dipakai, dan rekomendasi tindak lanjut.";
    const loadingId = makeId("loading");
    appendEntry({ id: loadingId, kind: "loading", startedAt: Date.now(), message: sysMsg, image: null, file: null });
    try {
      const resp = await chatbotApi.sendAgentControl({
        message: sysMsg,
        pageState: getPageState(),
        sessionId: sessionIdRef.current,
      });
      removeEntry(loadingId);
      if (resp.message) appendMessage("assistant", resp.message);
      const warnings = normalizeWarnings(resp.warnings);
      if (warnings.length) appendEntry({ id: makeId("warn"), kind: "warnings", warnings });
      if (resp.session_id && !sessionIdRef.current) setSessionId(resp.session_id);
    } catch (e) {
      removeEntry(loadingId);
      console.warn("SaveGeoChatbot: narrateResults failed", e);
    }
  }

  async function executeActionQueue(actions: ChatAction[], cardEntryId?: string) {
    const hadAnalysis = actions.some((a) => a.type === "run_analysis");
    const analysisTypes = actions.filter((a) => a.type === "run_analysis").map((a) => a.analysis || "");

    if (cardEntryId) updateConfirmCard(cardEntryId, { status: "running" });

    const ctx: ActionRunContext = {
      addAssistantMessage: (text) => appendMessage("assistant", text),
      addGuideStep: (step, total, title, body) =>
        appendEntry({ id: makeId("guide"), kind: "guideStep", step, total, title, body }),
      addChoiceCard: (question, choices: QuickAction[]) =>
        appendEntry({ id: makeId("choice"), kind: "choiceCard", question, choices, selectedIndex: null }),
      offerBoundaryDownload: (name, feature) => {
        if (!feature) {
          appendMessage("assistant", `Batas wilayah **${name}** sudah diset di peta.`);
          return;
        }
        const geoText = JSON.stringify({ type: "FeatureCollection", features: [feature] }, null, 2);
        const blob = new Blob([geoText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const safeName = name.replace(/[^a-zA-Z0-9_\- ]/g, "_").slice(0, 60);
        appendEntry({
          id: makeId("bnd"),
          kind: "boundaryDownload",
          name,
          downloadUrl: url,
          filename: `${safeName}.geojson`,
        });
      },
      setFileInputAccept: (accept) => setFileInputAccept(accept),
      getHotspotGeometry: (hotspotId) => hotspotGeometriesRef.current[hotspotId] || null,
    };

    await runActions(actions, ctx, (_action, i, total) => {
      setStatus(`Menjalankan ${i + 1}/${total}...`);
      if (cardEntryId) updateConfirmCard(cardEntryId, { runningStepIndex: i });
    });

    setStatus(DEFAULT_STATUS);
    if (cardEntryId) updateConfirmCard(cardEntryId, { status: "done" });
    setQuickActionsVisible(true);

    if (hadAnalysis) {
      await narrateResults(analysisTypes);
    } else if (!cardEntryId) {
      appendMessage("assistant", "Tindakan berhasil dijalankan.");
    }
  }

  function runConfirmCard(entryId: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "confirmCard") return;
    void executeActionQueue(entry.actions, entryId);
  }

  function cancelConfirmCard(entryId: string) {
    removeEntry(entryId);
    appendMessage("assistant", "Tindakan dibatalkan.");
    setQuickActionsVisible(true);
  }

  const geoContext: GeoAiContext | null = isOpen ? buildGeoAiContext() : null;

  return {
    // panel state
    isOpen,
    hasUnread,
    toggle,
    open,
    close,
    status,
    // context bar (spec section 13)
    aoiName: geoContext?.aoi_name ?? null,
    period: geoContext?.aoi ? geoContext.period : null,
    // log
    log,
    quickActions: quickActionsVisible ? buildSuggestedPrompts(geoContext ?? buildGeoAiContext()) : [],
    // attachments
    pendingImage,
    pendingFile,
    clearPendingImage,
    clearPendingFile,
    maxFileMb,
    fileInputAccept,
    handleFileSelected,
    handleCameraClick,
    cameraBusy,
    // send / loading
    isLoading,
    sendMessage,
    cancelLoading,
    retryLoadingNow,
    retryFromChip,
    // cards
    resolveAoiOffer,
    selectChoice,
    runConfirmCard,
    cancelConfirmCard,
    // sessions
    sessions,
    sessionId,
    sessionPanelOpen,
    toggleSessionPanel,
    sessionSearch,
    setSessionSearch,
    openSession,
    deleteSession,
    renameSession,
    newChat,
  };
}
