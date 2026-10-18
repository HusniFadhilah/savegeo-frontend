import type { AiCatalog, AiUsed } from "../types";

interface Props {
  status: string;
  onHistoryClick: () => void;
  onNewChatClick: () => void;
  onCloseClick: () => void;
  /** Context bar (spec section 13 desktop mock) - AOI/period currently grounding the assistant. */
  aoiName?: string | null;
  period?: string | null;
  aiCatalog?: AiCatalog | null;
  selectedAiId?: string | null;
  lastAi?: AiUsed | null;
  onSelectAi?: (id: string | null) => void;
}

export default function ChatHeader({
  status,
  onHistoryClick,
  onNewChatClick,
  onCloseClick,
  aoiName,
  period,
  aiCatalog,
  selectedAiId,
  lastAi,
  onSelectAi,
}: Props) {
  const activeChoice =
    aiCatalog?.providers.find((p) => p.id === selectedAiId) ??
    aiCatalog?.providers.find((p) => p.is_default);
  return (
    <>
      <div id="sgc-header">
        <div className="sgc-header-info">
          <div className="sgc-avatar">
            <i className="bi bi-robot" />
          </div>
          <div>
            <div className="sgc-title">SaveGeo Assistant</div>
            <div id="sgc-status" className="sgc-status">
              {status}
            </div>
          </div>
        </div>
        <div className="sgc-header-actions">
          <button type="button" title="Riwayat percakapan" onClick={onHistoryClick}>
            <i className="bi bi-clock-history" />
          </button>
          <button type="button" title="Percakapan baru" onClick={onNewChatClick}>
            <i className="bi bi-plus-lg" />
          </button>
          <button type="button" title="Tutup" onClick={onCloseClick}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>
      {aiCatalog && (
        <div id="sgc-model-bar">
          <i className="bi bi-cpu" aria-hidden="true" />
          {aiCatalog.selectable && onSelectAi ? (
            <select
              aria-label="Pilih model AI"
              value={activeChoice?.id ?? ""}
              onChange={(e) => onSelectAi(e.target.value || null)}
            >
              {aiCatalog.providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.label} · {p.model || "default"}
                  {p.available ? "" : ` (${p.message})`}
                </option>
              ))}
            </select>
          ) : (
            <span>
              {activeChoice?.label} · {activeChoice?.model || "default"}
            </span>
          )}
          {activeChoice && (
            <span
              className={`sgc-model-status ${activeChoice.available ? "ok" : "down"}`}
              title={activeChoice.message}
            >
              {activeChoice.available ? "siap" : "tidak tersedia"}
              {activeChoice.tool_calling === false ? " · tanpa tool-calling" : ""}
            </span>
          )}
          {lastAi?.fallback_used && (
            <span className="sgc-model-status fallback" title="Provider utama tidak tersedia">
              cadangan: {lastAi.provider}
            </span>
          )}
        </div>
      )}
      {(aoiName || period) && (
        <div id="sgc-context-bar">
          <span className="sgc-context-item">
            <i className="bi bi-bounding-box" /> {aoiName || <span className="sgc-context-empty">AOI belum diset</span>}
          </span>
          {period && (
            <span className="sgc-context-item">
              <i className="bi bi-calendar-range" /> {period}
            </span>
          )}
        </div>
      )}
    </>
  );
}
