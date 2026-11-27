import { useEffect, useState } from "react";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

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
  const c = useBilingualCopy();
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
        <div className="sgc-loading-phase">{slow ? c("Respons lambat — server sibuk?", "Slow response — is the server busy?") : c("Menghubungi AI...", "Contacting AI...")}</div>
        <div className="sgc-loading-footer">
          <span className="sgc-loading-elapsed">{elapsed} {c("detik", "seconds")}</span>
          <button type="button" className="sgc-loading-cancel" onClick={onCancel}>
            {c("Batalkan", "Cancel")}
          </button>
          {slow && (
            <button type="button" className="sgc-loading-retry" onClick={onRetry}>
              {c("Coba lagi", "Try again")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
