import { useEffect, useMemo, useState } from "react";

const HIMAWARI_TIMES_URL = "https://www.jma.go.jp/bosai/himawari/data/satimg/targetTimes_fd.json";
const HIMAWARI_TILE_URL =
  "https://www.jma.go.jp/bosai/himawari/data/satimg/{base}/fd/{valid}/REP/ETC/{z}/{x}/{y}.jpg";

type HimawariFrame = {
  basetime: string;
  validtime: string;
};

type HimawariExplorerPanelProps = {
  activeLayerUrl: string | null;
  opacity: number;
  onLayer: (url: string | null) => void;
  onOpacity: (opacity: number) => void;
};

function validFrame(value: unknown): value is HimawariFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Partial<HimawariFrame>;
  return (
    typeof frame.basetime === "string" &&
    /^\d{14}$/.test(frame.basetime) &&
    typeof frame.validtime === "string" &&
    /^\d{14}$/.test(frame.validtime)
  );
}

function formatFrameTime(value: string): string {
  if (!/^\d{14}$/.test(value)) return value;
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);
  return `${day}-${month}-${year} ${hour}:${minute} UTC`;
}

function buildTileUrl(frame: HimawariFrame): string {
  return HIMAWARI_TILE_URL.replace("{base}", frame.basetime).replace("{valid}", frame.validtime);
}

export default function HimawariExplorerPanel({
  activeLayerUrl,
  opacity,
  onLayer,
  onOpacity,
}: HimawariExplorerPanelProps) {
  const [frames, setFrames] = useState<HimawariFrame[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(HIMAWARI_TIMES_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error("Format waktu Himawari tidak valid.");
        const nextFrames = payload
          .filter(validFrame)
          .sort((a, b) => a.validtime.localeCompare(b.validtime));
        if (!nextFrames.length) throw new Error("Belum ada frame Himawari yang tersedia.");
        setFrames(nextFrames);
        setSelectedTime((current) =>
          current && nextFrames.some((frame) => frame.validtime === current)
            ? current
            : nextFrames[nextFrames.length - 1].validtime,
        );
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Gagal memuat daftar waktu Himawari.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const selectedFrame = useMemo(
    () => frames.find((frame) => frame.validtime === selectedTime) ?? null,
    [frames, selectedTime],
  );
  const selectedUrl = selectedFrame ? buildTileUrl(selectedFrame) : null;
  const layerVisible = Boolean(selectedUrl && activeLayerUrl === selectedUrl);

  return (
    <section className="card mb-3" aria-labelledby="himawariExplorerTitle">
      <div className="card-header py-2 d-flex align-items-center gap-2">
        <i className="bi bi-cloud-sun" aria-hidden="true" />
        <strong id="himawariExplorerTitle">Himawari-9 Weather Timeline</strong>
        <span className="badge bg-info text-dark ms-auto">JMA / UTC</span>
      </div>
      <div className="card-body py-2">
        <p className="small text-muted mb-2">
          Pilih waktu pengamatan full-disk Himawari untuk melihat awan dan sistem cuaca Asia-Pasifik
          di atas peta.
        </p>
        <div className="row g-2 align-items-end">
          <div className="col-md-8">
            <label className="form-label small fw-semibold mb-1" htmlFor="himawariFrameTime">
              Frame pengamatan
            </label>
            <select
              id="himawariFrameTime"
              className="form-select form-select-sm"
              value={selectedTime}
              disabled={loading || frames.length === 0}
              onChange={(event) => {
                const nextTime = event.target.value;
                const nextFrame = frames.find((frame) => frame.validtime === nextTime);
                if (selectedUrl && activeLayerUrl === selectedUrl && nextFrame) {
                  onLayer(buildTileUrl(nextFrame));
                }
                setSelectedTime(nextTime);
              }}
            >
              {frames.map((frame) => (
                <option key={frame.validtime} value={frame.validtime}>
                  {formatFrameTime(frame.validtime)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4 d-flex gap-2">
            <button
              type="button"
              className={`btn btn-sm flex-fill ${layerVisible ? "btn-primary" : "btn-outline-primary"}`}
              disabled={!selectedUrl || loading}
              aria-pressed={layerVisible}
              onClick={() => onLayer(layerVisible ? null : selectedUrl)}
            >
              <i className={`bi ${layerVisible ? "bi-eye-slash" : "bi-eye"} me-1`} />
              {layerVisible ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </div>
        {loading && (
          <div className="small text-muted mt-2" role="status">
            Memuat daftar waktu Himawari...
          </div>
        )}
        {error && (
          <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small" role="alert">
            {error}
          </div>
        )}
        {selectedFrame && (
          <>
            <div className="d-flex align-items-center gap-2 mt-2">
              <label className="small text-muted mb-0" htmlFor="himawariOpacity">
                Opacity
              </label>
              <input
                id="himawariOpacity"
                type="range"
                className="form-range mb-0"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => onOpacity(Number(event.target.value))}
                disabled={!layerVisible}
              />
              <span className="small text-muted" style={{ minWidth: 38 }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <small className="text-muted d-block mt-1">
              Sumber: JMA Himawari-9 true-color reproduction / frame{" "}
              {formatFrameTime(selectedFrame.validtime)}. Citra cuaca beresolusi km-level, bukan
              scene optik detail untuk analisis tutupan lahan.
            </small>
          </>
        )}
      </div>
    </section>
  );
}
