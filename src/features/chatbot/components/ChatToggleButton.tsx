interface Props {
  onClick: () => void;
  hasUnread: boolean;
  isOpen: boolean;
}

/**
 * `isOpen` toggles `.sgc-toggle-open` - on mobile the chat panel goes full-
 * width/anchored to the bottom of the screen (see chatbot.css's `max-width:
 * 540px` block), landing right under this fixed bottom-right button, which
 * then covers the panel's own bottom-right content (last quick-action chip,
 * start of the input area). Desktop keeps the button visible while open
 * (panel there is a floating card well clear of it) - only the mobile rule
 * hides it.
 */
export default function ChatToggleButton({ onClick, hasUnread, isOpen }: Props) {
  return (
    <button
      type="button"
      id="sgc-toggle-btn"
      className={isOpen ? "sgc-toggle-open" : undefined}
      title="SaveGeo Assistant"
      onClick={onClick}
    >
      <i className="bi bi-robot" />
      {hasUnread && (
        <span id="sgc-badge" className="sgc-badge">
          1
        </span>
      )}
    </button>
  );
}
