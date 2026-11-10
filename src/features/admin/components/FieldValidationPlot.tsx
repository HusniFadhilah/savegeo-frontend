import type { Metric } from "./carbonFieldApi";

export default function FieldValidationPlot({
  baseline,
  corrected,
  independent,
}: {
  baseline: Metric;
  corrected?: Metric;
  independent: boolean;
}) {
  const series = [
    { label: "Sebelum kalibrasi", color: "#2482c5", rows: baseline.rows ?? [] },
    { label: "Setelah kalibrasi", color: "#26924c", rows: corrected?.rows ?? [] },
  ];
  const values = series
    .flatMap((group) => group.rows)
    .filter((row) => Number.isFinite(row.observed) && Number.isFinite(row.predicted));
  if (!values.length) return null;
  const bound =
    values.reduce((maximum, row) => Math.max(maximum, row.observed, row.predicted), 1) * 1.08;
  const lower = values.reduce((minimum, row) => Math.min(minimum, row.observed, row.predicted), 0);
  const limited = series.some((group) => group.rows.length > 1000);
  const x = (value: number) => 64 + ((value - lower) / (bound - lower)) * 360;
  const y = (value: number) => 228 - ((value - lower) / (bound - lower)) * 190;
  return (
    <figure className="border rounded p-3 mt-3 mb-0">
      <figcaption className="fw-semibold">
        Referensi lapangan dan prediksi ·{" "}
        {independent
          ? "plot validasi terpisah"
          : corrected?.status === "computed"
            ? "leave-one-plot-out"
            : "data kalibrasi"}
      </figcaption>
      <svg
        viewBox="0 0 480 290"
        role="img"
        aria-label="Diagram sebar densitas karbon lapangan versus prediksi, sebelum dan setelah kalibrasi"
        style={{ width: "100%", maxHeight: 320 }}
      >
        <line x1={64} y1={38} x2={64} y2={228} stroke="currentColor" />
        <line x1={64} y1={228} x2={424} y2={228} stroke="currentColor" />
        <line
          x1={64}
          y1={228}
          x2={424}
          y2={38}
          stroke="currentColor"
          opacity={0.4}
          strokeDasharray="5 4"
        />
        {[0, 1, 2, 3, 4].map((i) => {
          const value = lower + ((bound - lower) * i) / 4;
          const label = value.toLocaleString("id-ID", { maximumSignificantDigits: 3 });
          return (
            <g key={i} fill="currentColor" fontSize={10}>
              <text x={x(value)} y={245} textAnchor="middle">
                {label}
              </text>
              <text x={54} y={y(value) + 3} textAnchor="end">
                {label}
              </text>
            </g>
          );
        })}
        {series.map((group) => (
          <g key={group.label}>
            {group.rows
              .filter((row) => Number.isFinite(row.observed) && Number.isFinite(row.predicted))
              .filter((_, index) => index % Math.max(1, Math.ceil(group.rows.length / 1000)) === 0)
              .map((row) => (
                <circle
                  key={row.plot_id}
                  cx={x(row.observed)}
                  cy={y(row.predicted)}
                  r={4}
                  fill={group.color}
                  opacity={0.8}
                >
                  <title>
                    {row.plot_id}: lapangan {row.observed.toFixed(3)}; prediksi{" "}
                    {row.predicted.toFixed(3)} Mg C/ha · {group.label}
                  </title>
                </circle>
              ))}
          </g>
        ))}
        <text x={244} y={274} textAnchor="middle" fill="currentColor" fontSize={12}>
          Lapangan (Mg C/ha)
        </text>
        <text
          x={16}
          y={135}
          transform="rotate(-90 16 135)"
          textAnchor="middle"
          fill="currentColor"
          fontSize={12}
        >
          Prediksi (Mg C/ha)
        </text>
      </svg>
      <div className="d-flex gap-3 flex-wrap small">
        {series
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <span key={group.label}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: group.color,
                }}
              />{" "}
              {group.label}
            </span>
          ))}
        <span>Garis putus-putus: prediksi = lapangan</span>
      </div>
      <p className="small text-muted mt-2 mb-0">
        {independent
          ? "Plot pada grafik tidak dipakai untuk menghitung koefisien kalibrasi."
          : corrected?.status === "computed"
            ? "Belum tersedia validasi terpisah. Prediksi kalibrasi pada grafik dihitung ketika setiap plot dikeluarkan dari pelatihan."
            : "Kalibrasi belum dapat dihitung. Grafik menampilkan prediksi awal; tambahkan plot kalibrasi yang memenuhi syarat."}
        {limited &&
          " Grafik diringkas hingga 1.000 titik per seri; statistik dan unduhan JSON tetap mencakup seluruh plot."}
      </p>
    </figure>
  );
}
