interface Props {
  onClick: () => void;
  hasUnread: boolean;
}

export default function ChatToggleButton({ onClick, hasUnread }: Props) {
  return (
    <button type="button" id="sgc-toggle-btn" title="SaveGeo Assistant" onClick={onClick}>
      <i className="bi bi-robot" />
      {hasUnread && (
        <span id="sgc-badge" className="sgc-badge">
          1
        </span>
      )}
    </button>
  );
}
