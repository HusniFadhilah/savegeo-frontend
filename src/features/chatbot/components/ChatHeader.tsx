import { useBilingualCopy } from "@/hooks/useBilingualCopy";

interface Props {
  status: string;
  onHistoryClick: () => void;
  onNewChatClick: () => void;
  onCloseClick: () => void;
  /** Current AOI and period used to ground the assistant. */
  aoiName?: string | null;
  period?: string | null;
}
export default function ChatHeader({
  status,
  onHistoryClick,
  onNewChatClick,
  onCloseClick,
  aoiName,
  period,
}: Props) {
  const c = useBilingualCopy();
  return (
    <>
      <div id="sgc-header">
        <div className="sgc-header-info">
          <div className="sgc-avatar">
            <i className="bi bi-robot" />
          </div>
          <div>
            <div className="sgc-title">{c("Asisten SaveGeo", "SaveGeo Assistant")}</div>
            <div id="sgc-status" className="sgc-status">
              {status}
            </div>
          </div>
        </div>
        <div className="sgc-header-actions">
          <button type="button" title={c("Riwayat percakapan", "Conversation history")} onClick={onHistoryClick}>
            <i className="bi bi-clock-history" />
          </button>
          <button type="button" title={c("Percakapan baru", "New conversation")} onClick={onNewChatClick}>
            <i className="bi bi-plus-lg" />
          </button>
          <button type="button" title={c("Tutup", "Close")} onClick={onCloseClick}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>
      {(aoiName || period) && (
        <div id="sgc-context-bar">
          <span className="sgc-context-item">
            <i className="bi bi-bounding-box" /> {aoiName || <span className="sgc-context-empty">{c("AOI belum ditetapkan", "AOI not set")}</span>}
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
