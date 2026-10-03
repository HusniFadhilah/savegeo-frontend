import { describe, expect, it } from "vitest";
import { EOX_CLOUDLESS_YEARS, eoxCloudlessTileUrl } from "./eoxCloudless";

describe("EOX Sentinel-2 Cloudless historical mosaics", () => {
  it("lists available annual mosaics and omits 2017", () => {
    expect(EOX_CLOUDLESS_YEARS).toEqual([2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(EOX_CLOUDLESS_YEARS).not.toContain(2017);
  });

  it("builds annual WMTS tile templates", () => {
    expect(eoxCloudlessTileUrl(2025)).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
    );
  });
});
