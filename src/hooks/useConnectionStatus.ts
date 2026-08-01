import { useEffect, useRef, useState } from "react";
import { fetchHealth } from "@/services/analysisService";
import type { HealthStatus } from "@/types/api";

export type ConnectionState = "connecting" | "online" | "offline";

const POLL_INTERVAL_MS = 60_000;

export function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const check = async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setState(data.ee_initialized ? "online" : "offline");
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
