export const NASA_GIBS_FIRST_DATE = "2000-02-24";
export const NASA_GIBS_VIIRS_NIGHT_FIRST_DATE = "2016-12-03";
export const NASA_GIBS_BLACK_MARBLE_YEARS = [2012, 2016] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function dateTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function clampNasaGibsDate(date: string, today: string, firstDate = NASA_GIBS_FIRST_DATE): string {
  const parsed = new Date(dateTimestamp(date));
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === date;
  const normalized = isValidDate ? date : today;
  return normalized < firstDate ? firstDate : normalized > today ? today : normalized;
}

/** Zero-based day offset for the horizontal NASA imagery timeline. */
export function nasaGibsDateIndex(date: string, today: string, firstDate = NASA_GIBS_FIRST_DATE): number {
  const clampedDate = clampNasaGibsDate(date, today, firstDate);
  return Math.max(0, Math.round((dateTimestamp(clampedDate) - dateTimestamp(firstDate)) / DAY_MS));
}

/** Convert the timeline's day offset back into an available archive date. */
export function nasaGibsDateAt(index: number, today: string, firstDate = NASA_GIBS_FIRST_DATE): string {
  const maxIndex = nasaGibsDateIndex(today, today, firstDate);
  const safeIndex = Math.max(0, Math.min(maxIndex, Math.trunc(index)));
  return new Date(dateTimestamp(firstDate) + safeIndex * DAY_MS).toISOString().slice(0, 10);
}

/** Place a compact set of year labels along the NASA daily timeline. */
export function nasaGibsTimelineTicks(today: string, firstDate = NASA_GIBS_FIRST_DATE): Array<{ year: string; position: number }> {
  const endDate = clampNasaGibsDate(today, today, firstDate);
  const firstYear = Number(firstDate.slice(0, 4));
  const lastYear = Number(endDate.slice(0, 4));
  const step = Math.max(1, Math.ceil((lastYear - firstYear) / 5));
  const years = new Set<number>([firstYear, lastYear]);
  for (let year = firstYear + step; year < lastYear; year += step) years.add(year);

  const maxIndex = Math.max(1, nasaGibsDateIndex(endDate, today));
  return [...years].sort((a, b) => a - b).map((year) => ({
    year: String(year),
    position: year === lastYear ? 100 : nasaGibsDateIndex(`${year}-01-01`, endDate, firstDate) / maxIndex * 100,
  }));
}

export function nasaGibsTrueColorTileUrl(date: string): string {
  return `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

/** Static Earth-at-Night 2012 composite; it has no time dimension. */
export function nasaGibsCityLights2012TileUrl(): string {
  return "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg";
}

export function nasaGibsViirsNightTileUrl(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_ENCC/default/${date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}

export type NasaGibsBlackMarbleYear = (typeof NASA_GIBS_BLACK_MARBLE_YEARS)[number];

export function nasaGibsBlackMarbleTileUrl(year: NasaGibsBlackMarbleYear): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/${year}-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}
