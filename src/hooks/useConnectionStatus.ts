import { useEffect, useRef, useState } from "react";
import { fetchHealth } from "@/services/analysisService";
import type { HealthStatus } from "@/types/api";

/** `degraded` means the API answered successfully but an optional analysis
 * provider (currently Earth Engine) is unavailable. It must not be presented
 * to users as a disconnected backend. */
export type ConnectionState = "connecting" | "online" | "degraded" | "offline";

const POLL_INTERVAL_MS = 60_000;

export function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const check = async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setState(data.ee_initialized ? "online" : "degraded");
    } catch {
      setHealth(null);
      setState("offline");
    }
  };

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  return { state, health, recheck: check };
}
