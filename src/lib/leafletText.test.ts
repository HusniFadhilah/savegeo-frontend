import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHighlight, highlightPolygon, registerMap } from "@/features/chatbot/mapActions";
import { plainTextContent } from "./leafletText";

const PAYLOAD = '<img src=x onerror="window.__xss = 1">Jakarta';

describe("plainTextContent", () => {
  it("keeps markup as literal text", () => {
    const element = plainTextContent(PAYLOAD);
    expect(element.textContent).toBe(PAYLOAD);
    expect(element.querySelector("img")).toBeNull();
    expect(element.children).toHaveLength(0);
  });
});

describe("assistant highlight tooltip", () => {
  afterEach(() => {
    clearHighlight();
    registerMap("results", null);
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("renders geocoder or assistant labels as text, not HTML", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const map = { getContainer: () => container, getPane: () => undefined, removeLayer: vi.fn() } as unknown as L.Map;
    registerMap("results", map);
    // jsdom has no SVG renderer; adding the layer is irrelevant to this check.
    vi.spyOn(L.GeoJSON.prototype, "addTo").mockImplementation(function (this: L.GeoJSON) { return this; });
    const bindTooltip = vi.spyOn(L.GeoJSON.prototype, "bindTooltip");

    highlightPolygon(
      { type: "Polygon", coordinates: [[[106.7, -6.3], [106.9, -6.3], [106.9, -6.1], [106.7, -6.3]]] },
      { label: PAYLOAD, zoomTo: false },
    );

    expect(bindTooltip).toHaveBeenCalledTimes(1);
    const content = bindTooltip.mock.calls[0][0];
    expect(content).toBeInstanceOf(HTMLElement);
    expect((content as HTMLElement).textContent).toBe(PAYLOAD);
    expect((content as HTMLElement).querySelector("img")).toBeNull();
  });
});
