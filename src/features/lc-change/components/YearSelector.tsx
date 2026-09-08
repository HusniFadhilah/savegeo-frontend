import { useState } from "react";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  years: number[];
  minYear: number;
  maxYear: number;
  onChange: (years: number[]) => void;
}

type Mode = "list" | "slider";

/**
 * Ports LCChange.addYear/removeYear/getSelectedYears (main.js): a list of
 * year rows, minimum 2, each a plain <select> - kept as the "list" mode
 * below, unchanged. Added a "slider" mode: a dual-handle range slider that
 * picks exactly a [start, end] pair in one gesture, for the common case of
 * just comparing two years instead of building a list one at a time. Both
 * modes write to the same `years` array via `onChange` - switching modes
 * doesn't reset a selection made in the other one.
 */
export default function YearSelector({ years, minYear, maxYear, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("list");

  const options: number[] = [];
  for (let y = maxYear; y >= minYear; y--) options.push(y);

  const setYearAt = (index: number, value: number) => {
    const next = [...years];
    const previous = next[index];
    const duplicateIndex = next.findIndex((year, i) => i !== index && year === value);
    // Choosing a year already used by another row should swap the two rows,
    // not collapse the selection from two years to one.
    if (duplicateIndex >= 0) next[duplicateIndex] = previous;
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

  const sliderStart = Math.min(...years, maxYear);
  const sliderEnd = Math.max(...years, minYear);

  const setSliderRange = (start: number, end: number) => {
    if (start > end) [start, end] = [end, start];
    if (start === end) {
      // Keep two distinct years - nudge whichever bound has room to move.
      if (end < maxYear) end += 1;
      else start -= 1;
    }
    // Every year in [start, end], not just the two endpoints - a 2015-2026
    // drag should analyze all 12 years in between, not skip straight from
    // 2015 to 2026.
    const range: number[] = [];
    for (let y = start; y <= end; y++) range.push(y);
    onChange(range);
  };

  const spanPct = (v: number) => ((v - minYear) / Math.max(1, maxYear - minYear)) * 100;

  return (
    <div>
      <div className="btn-group btn-group-sm w-100 mb-2" role="group" aria-label="Mode pilih tahun">
        <button
          type="button"
          className={`btn btn-outline-secondary ${mode === "list" ? "active" : ""}`}
          onClick={() => setMode("list")}
        >
          <i className="bi bi-list-ol" /> Custom
        </button>
        <button
          type="button"
          className={`btn btn-outline-secondary ${mode === "slider" ? "active" : ""}`}
          onClick={() => setMode("slider")}
        >
          <i className="bi bi-sliders" /> Slider Rentang
        </button>
      </div>

      {mode === "list" && (
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
      )}

      {mode === "slider" && (
        <div>
          <div className="d-flex justify-content-between mb-1">
            <span className="badge bg-success">{sliderStart}</span>
            <span className="text-muted small align-self-center">sampai</span>
            <span className="badge bg-success">{sliderEnd}</span>
          </div>
          <div className="dual-range-slider">
            <div className="dual-range-track" />
            <div
              className="dual-range-fill"
              style={{ left: `${spanPct(sliderStart)}%`, right: `${100 - spanPct(sliderEnd)}%` }}
            />
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={sliderStart}
              onChange={(e) => setSliderRange(Number(e.target.value), sliderEnd)}
              aria-label="Tahun awal"
            />
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={sliderEnd}
              onChange={(e) => setSliderRange(sliderStart, Number(e.target.value))}
              aria-label="Tahun akhir"
            />
          </div>
          <div className="d-flex justify-content-between text-muted" style={{ fontSize: ".72rem" }}>
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
          <small className="text-muted d-block mt-1">Geser kedua gagang untuk pilih tahun awal &amp; akhir</small>
        </div>
      )}
    </div>
  );
}
