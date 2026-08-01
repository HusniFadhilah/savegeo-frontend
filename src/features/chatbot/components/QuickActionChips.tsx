import type { QuickAction } from "../types";

interface Props {
  actions: QuickAction[];
  onSelect: (msg: string) => void;
}

export default function QuickActionChips({ actions, onSelect }: Props) {
  if (!actions.length) return <div id="sgc-quick-actions" />;
  return (
    <div id="sgc-quick-actions">
      {actions.map((a, i) => (
        <button key={i} type="button" className="sgc-chip" onClick={() => onSelect(a.msg)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}
