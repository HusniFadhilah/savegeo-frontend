import { useState } from "react";

export default function DetritusSampleFields({ pool }: { pool: "litter" | "deadwood" }) {
  const [pieces, setPieces] = useState([0]);
  const number = (name: string, label: string, min = 0, step = "any") => (
    <label className="col-md-4 form-label">
      {label}
      <input name={name} type="number" step={step} min={min} required className="form-control" />
    </label>
  );
  if (pool === "litter")
    return (
      <div className="col-12">
        <div className="border rounded p-3">
          <h4 className="h6">Sampel komposit serasah</h4>
          <p className="small text-muted">
            Luas yang digunakan adalah jumlah kuadrat × luas setiap kuadrat. Fraksi kering berasal
            dari subsampel, lalu dikalikan berat basah komposit dan fraksi karbon.
          </p>
          <div className="row g-2">
            {number("litterWet", "Berat basah komposit (kg)", 0.000001)}
            {number("litterSubWet", "Berat basah subsampel (kg)", 0.000001)}
            {number("litterSubDry", "Berat kering subsampel (kg)")}
            {number("litterQuadrats", "Jumlah kuadrat", 1, "1")}
            {number("litterQuadratArea", "Luas setiap kuadrat (m²)", 0.000001)}
            {number("litterDiameter", "Batas diameter maksimum serasah (cm)", 0.000001)}
          </div>
        </div>
      </div>
    );
  return (
    <div className="col-12">
      <div className="border rounded p-3">
        <h4 className="h6">Volume kayu mati dalam plot</h4>
        <p className="small text-muted">
          Pisahkan kayu berdiri dan rebah. Gunakan kerapatan kering yang sesuai kelas pelapukan;
          tidak ada pengurangan berat otomatis. Volume harus mewakili inventaris dalam luas plot,
          bukan volume yang belum diekspansi dari transek.
        </p>
        <div className="row g-2">
          {number("deadwoodDiameter", "Batas diameter minimum kayu mati (cm)", 0.000001)}
        </div>
        {pieces.map((id, index) => (
          <fieldset key={id} className="border rounded p-2 mt-2">
            <legend className="float-none w-auto fs-6 px-1">Komponen {index + 1}</legend>
            <div className="row g-2">
              <label className="col-md-4 form-label">
                Posisi kayu
                <select name="deadwoodComponent" className="form-select">
                  <option value="standing">Berdiri</option>
                  <option value="downed">Rebah</option>
                </select>
              </label>
              {number("deadwoodVolume", "Volume (m³)", 0.000001)}
              {number("deadwoodDensity", "Kerapatan kering (kg/m³)", 0.000001)}
              <label className="col-md-4 form-label">
                Kelas pelapukan
                <input name="deadwoodDecay" className="form-control" maxLength={64} required />
              </label>
              <label className="col-md-8 form-label">
                Sumber kerapatan (uji / literatur)
                <input
                  name="deadwoodDensitySource"
                  className="form-control"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
            </div>
            {pieces.length > 1 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger mt-2"
                onClick={() => setPieces(pieces.filter((value) => value !== id))}
              >
                Hapus komponen {index + 1}
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mt-2"
          disabled={pieces.length >= 500}
          onClick={() => setPieces([...pieces, Math.max(...pieces) + 1])}
        >
          Tambah komponen
        </button>
      </div>
    </div>
  );
}
