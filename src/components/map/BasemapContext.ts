import { createContext, useContext } from "react";

interface BasemapContextValue {
  activeBasemapId: string | null;
  setActiveBasemapId: (id: string) => void;
}

const noop = () => {};

/**
 * Which basemap is currently showing on *this* particular map instance -
 * each `MapView` gets its own Provider, so two maps on screen at once (e.g.
 * LC-Change's before/after split, each with its own `BasemapSwitcher`) can
 * independently be on different basemaps without clobbering each other.
 * Written by `BasemapSwitcher` when one is present; read by
 * `ImageryAttribution` to know whether the Esri satellite capture-date
 * lookup applies to what's actually showing right now.
 */
export const BasemapContext = createContext<BasemapContextValue>({
  activeBasemapId: null,
  setActiveBasemapId: noop,
});

export function useBasemapContext() {
  return useContext(BasemapContext);
}
