export const EOX_CLOUDLESS_YEARS = [2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;

export type EoxCloudlessYear = (typeof EOX_CLOUDLESS_YEARS)[number];

export function eoxCloudlessTileUrl(year: EoxCloudlessYear): string {
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`;
}
