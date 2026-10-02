import type { ImageryScene } from "./types";

const HIMAWARI_TIMES_URL = "https://www.jma.go.jp/bosai/himawari/data/satimg/targetTimes_fd.json";
const HIMAWARI_TILE_URL =
  "https://www.jma.go.jp/bosai/himawari/data/satimg/{base}/fd/{valid}/REP/ETC/{z}/{x}/{y}.jpg";

type HimawariFrame = {
  basetime: string;
  validtime: string;
};

function isHimawariFrame(value: unknown): value is HimawariFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Partial<HimawariFrame>;
  return (
    typeof frame.basetime === "string" &&
    /^\d{14}$/.test(frame.basetime) &&
    typeof frame.validtime === "string" &&
    /^\d{14}$/.test(frame.validtime)
  );
}

function toIsoUtc(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
}

function sceneId(frame: HimawariFrame): string {
  return `himawari:${frame.basetime}:${frame.validtime}`;
}

export function himawariTileUrlFromSceneId(id: string): string | null {
  const match = /^himawari:(\d{14}):(\d{14})$/.exec(id);
  if (!match) return null;
  return HIMAWARI_TILE_URL.replace("{base}", match[1]).replace("{valid}", match[2]);
}

/** Load JMA full-disk frames and adapt them to the shared imagery scene table model. */
export async function listHimawariScenes(startDate: string, endDate: string): Promise<ImageryScene[]> {
  const response = await fetch(HIMAWARI_TIMES_URL);
  if (!response.ok) throw new Error(`Gagal memuat waktu Himawari dari JMA (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Format daftar waktu Himawari dari JMA tidak valid.");

  return payload
    .filter(isHimawariFrame)
    .filter((frame) => {
      const frameDate = frame.validtime.slice(0, 8);
      return frameDate >= startDate.replace(/-/g, "") && frameDate <= endDate.replace(/-/g, "");
    })
    .sort((a, b) => b.validtime.localeCompare(a.validtime))
    .map((frame) => ({
      id: sceneId(frame),
      acquired_at: toIsoUtc(frame.validtime),
      cloud_cover_pct: null,
      resolution_m: 2000,
      platform: "Himawari-9",
      producer: "JMA",
      title: "Full-disk",
    }));
}
