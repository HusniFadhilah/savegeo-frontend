import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface InfoTipProps {
  content: ReactNode;
  label: string;
  align?: "start" | "end";
}

export default function InfoTip({ content, label, align = "start" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();
    if (!triggerRect || !popoverRect) return;

    const margin = 12;
    const requestedLeft = align === "end" ? triggerRect.right - popoverRect.width : triggerRect.left;
    const left = Math.min(
      Math.max(margin, requestedLeft),
      Math.max(margin, window.innerWidth - popoverRect.width - margin),
    );
    const below = triggerRect.bottom + 6;
    const top = below + popoverRect.height > window.innerHeight - margin
      ? Math.max(margin, triggerRect.top - popoverRect.height - 6)
      : below;
    setPosition({ top, left });
  }, [align, content, open]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="inline-info-tip">
      <button
        ref={triggerRef}
        type="button"
        className="inline-info-tip__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <i className="bi bi-info-circle" aria-hidden="true" />
      </button>
      {open && createPortal(
        <span
          ref={popoverRef}
          id={id}
          className="inline-info-tip__popover"
          style={{ top: position.top, left: position.left }}
          role="tooltip"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
