import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import L from "leaflet";
import LayerOpacityControl from "./LayerOpacityControl";

let testMap: L.Map;
let container: HTMLDivElement;
vi.mock("react-leaflet", () => ({ useMap: () => testMap }));
afterEach(() => { cleanup(); testMap.remove(); container.remove(); });

it("renders an untrusted label as text and keeps the opacity slider functional", () => {
  container = document.createElement("div");
  document.body.append(container);
  testMap = L.map(container);
  const onChange = vi.fn();
  const label = '<img src=x onerror="alert(1)">';
  render(<LayerOpacityControl label={label} opacity={0.5} onChange={onChange} />);
  expect(container.querySelector(".opacity-panel-label")?.textContent).toBe(`${label}: 50%`);
  expect(container.querySelector(".opacity-panel img")).toBeNull();
  const slider = container.querySelector<HTMLInputElement>(".opacity-panel input")!;
  fireEvent.input(slider, { target: { value: "0.75" } });
  expect(onChange).toHaveBeenCalledWith(0.75);
});
