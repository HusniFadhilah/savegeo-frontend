export const NASA_GIBS_FIRST_DATE = "2000-02-24";

export function clampNasaGibsDate(date: string, today: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === date;
  const normalized = isValidDate ? date : today;
  return normalized < NASA_GIBS_FIRST_DATE ? NASA_GIBS_FIRST_DATE : normalized > today ? today : normalized;
}

export function nasaGibsTrueColorTileUrl(date: string): string {
  return `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}
