import { useEffect } from "react";
import { create } from "zustand";

export type LocationStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "timeout" | "error";
interface LocationState {
  latitude: number | null; longitude: number | null; accuracy: number | null;
  heading: number | null; speed: number | null; timestamp: number | null;
  status: LocationStatus; follow: boolean; visible: boolean; revision: number;
  locate: () => void; setFollow: (follow: boolean) => void; setVisible: (visible: boolean) => void;
}
let watcher: number | null = null;
let consumers = 0;
let generation = 0;
const stop = () => {
  generation++;
  if (watcher !== null) navigator.geolocation?.clearWatch(watcher);
  watcher = null;
};
export const useLocationStore = create<LocationState>((set, get) => {
  const request = (follow: boolean) => {
    stop();
    if (!window.isSecureContext || !navigator.geolocation) {
      set({ status: "unavailable", follow: false }); return;
    }
    const current = generation;
    set({ status: "requesting", follow, visible: true });
    const success = (position: GeolocationPosition) => {
      if (current !== generation) return;
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      set({ latitude, longitude, accuracy, heading, speed, timestamp: position.timestamp, status: "active", revision: get().revision + 1 });
    };
    const failure = (error: GeolocationPositionError) => {
      if (current !== generation) return;
      stop();
      set({ status: error.code === 1 ? "denied" : error.code === 2 ? "unavailable" : error.code === 3 ? "timeout" : "error", follow: false });
    };
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };
    if (follow) watcher = navigator.geolocation.watchPosition(success, failure, options);
    else navigator.geolocation.getCurrentPosition(success, failure, options);
  };
  return {
    latitude: null, longitude: null, accuracy: null, heading: null, speed: null, timestamp: null,
    status: "idle", follow: false, visible: true, revision: 0,
    locate: () => request(false),
    setFollow: (follow) => { if (follow) request(true); else { stop(); set({ follow: false, status: get().latitude === null ? "idle" : "active" }); } },
    setVisible: (visible) => { if (!visible) { stop(); set({ follow: false }); } set({ visible }); },
  };
});

/** One watcher for all mounted maps; never persist precise coordinates. */
export function useUserGeolocation() {
  const state = useLocationStore();
  useEffect(() => {
    consumers++;
    return () => {
      consumers--;
      // Permit a 2D/3D handoff in the same React commit.
      queueMicrotask(() => { if (!consumers) useLocationStore.getState().setFollow(false); });
    };
  }, []);
  return state;
}
