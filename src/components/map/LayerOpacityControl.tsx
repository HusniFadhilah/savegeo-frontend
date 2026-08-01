interface Props {
  opacity: number;
  onChange: (value: number) => void;
  label?: string;
}

export default function LayerOpacityControl({ opacity, onChange, label = "Opacity" }: Props) {
  return (
    <div className="layer-opacity-control">
      <label className="form-label small mb-1">
        {label}: {Math.round(opacity * 100)}%
      </label>
      <input
        type="range"
        className="form-range"
        min={0}
        max={1}
        step={0.05}
        value={opacity}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
