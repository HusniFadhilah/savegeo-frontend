interface Props {
  status: string;
  onHistoryClick: () => void;
  onNewChatClick: () => void;
  onCloseClick: () => void;
}

export default function ChatHeader({ status, onHistoryClick, onNewChatClick, onCloseClick }: Props) {
  return (
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
  );
}
