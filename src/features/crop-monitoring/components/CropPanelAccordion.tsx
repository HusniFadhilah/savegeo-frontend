import { useState, type ReactNode, type SyntheticEvent } from "react";
import "./crop-panel-accordion.css";

interface Props {
  className?: string;
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
  headerTrailing?: ReactNode;
}

export default function CropPanelAccordion({
  className = "",
  title,
  icon,
  children,
  defaultOpen = false,
  headerTrailing,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={`card mb-3 cm-panel-accordion ${className}`}
      open={open}
      onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
    >
      <summary className="card-header cm-panel-accordion-summary">
        <i className={`bi ${icon}`} aria-hidden="true" />
        <span className="cm-panel-accordion-title">{title}</span>
        {headerTrailing && <span className="cm-panel-accordion-trailing">{headerTrailing}</span>}
        <i className="bi bi-chevron-down cm-panel-accordion-chevron" aria-hidden="true" />
      </summary>
      <div className="card-body">{children}</div>
    </details>
  );
}
