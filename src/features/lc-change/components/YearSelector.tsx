import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  years: number[];
  minYear: number;
  maxYear: number;
  onChange: (years: number[]) => void;
}

/**
 * Ports LCChange.addYear/removeYear/getSelectedYears (main.js): a list of
 * year rows, minimum 2, each a plain <select>. Order is normalized (sorted,
 * deduped) by the parent whenever this fires onChange.
 */
export default function YearSelector({ years, minYear, maxYear, onChange }: Props) {
  const options: number[] = [];
  for (let y = maxYear; y >= minYear; y--) options.push(y);

  const setYearAt = (index: number, value: number) => {
    const next = [...years];
    next[index] = value;
    onChange([...new Set(next)].sort((a, b) => a - b));
  };

  const addYear = () => {
    const preset = years.includes(maxYear) ? maxYear - 1 : maxYear;
    const candidate = years.includes(preset) ? options.find((y) => !years.includes(y)) ?? preset : preset;
    onChange([...new Set([...years, candidate])].sort((a, b) => a - b));
  };

  const removeYear = (index: number) => {
    if (years.length <= 2) return;
    const next = years.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div>
      {years.map((year, i) => (
        <div className="d-flex align-items-center gap-2 mb-1" key={i}>
          <span className="text-muted small fw-bold" style={{ minWidth: 18 }}>
            {i + 1}
          </span>
          <div style={{ maxWidth: 100 }}>
            <SearchableSelect
              value={String(year)}
              onChange={(v) => setYearAt(i, Number(v))}
              options={options.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {years.length > 2 ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-0 px-1"
              style={{ lineHeight: 1.4 }}
              onClick={() => removeYear(i)}
              aria-label="Hapus tahun"
            >
              <i className="bi bi-x" style={{ fontSize: 12 }} />
            </button>
          ) : (
            <span style={{ width: 28 }} />
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-1" onClick={addYear}>
        <i className="bi bi-plus-circle" /> Tambah Tahun
      </button>
      <small className="text-muted d-block mt-1">Minimal 2 · Urutan otomatis</small>
    </div>
  );
}
