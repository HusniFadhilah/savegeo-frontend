import { useEffect, useState } from "react";

interface Props {
  startedAt: number;
  onCancel: () => void;
  onRetry: () => void;
}

/**
 * Loading indicator with its own elapsed-time ticker (kept local so a
 * ticking clock doesn't re-render the whole message log every second).
 * After 30s, offers an inline "Coba Lagi" retry alongside "Batalkan",
 * matching the original widget's slow-response affordance.
 */
export default function LoadingBubble({ startedAt, onCancel, onRetry }: Props) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const slow = elapsed >= 30;

  return (
    <div className="sgc-message sgc-assistant">
      <div className="sgc-bubble sgc-loading-bubble">
        <div className="sgc-loading-dots">
          <span className="sgc-dot" />
          <span className="sgc-dot" />
          <span className="sgc-dot" />
        </div>
        <div className="sgc-loading-phase">{slow ? "Respons lambat — server sibuk?" : "Menghubungi AI..."}</div>
        <div className="sgc-loading-footer">
          <span className="sgc-loading-elapsed">{elapsed} detik</span>
          <button type="button" className="sgc-loading-cancel" onClick={onCancel}>
            Batalkan
          </button>
          {slow && (
            <button type="button" className="sgc-loading-retry" onClick={onRetry}>
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
