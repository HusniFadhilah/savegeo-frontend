import { describe, expect, it } from "vitest";
import { readCloudDatasetQuery } from "./queryState";

describe("cloud dataset URL state", () => {
  it("reads only compact dataset references", () => {
    expect(readCloudDatasetQuery("?datasetId=abc123&format=geoparquet&url=https%3A%2F%2Fsecret.example%2Fx")).toEqual({ id: "abc123", format: "geoparquet" });
    expect(readCloudDatasetQuery("?datasetId=bad%20id&format=cog")).toBeNull();
  });
});

