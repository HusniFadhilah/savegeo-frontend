import { useCallback, useEffect, useRef, useState } from "react";
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
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const sequence = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const check = useCallback(async () => {
    const current = ++sequence.current;
    setChecking(true);
    try {
      const data = await fetchHealth();
      if (current !== sequence.current) return;
      setHealth(data);
      setState(data.status === "ok" && data.ee_initialized ? "online" : "degraded");
    } catch {
      if (current !== sequence.current) return;
      setHealth(null);
      setState("offline");
    } finally {
      if (current === sequence.current) {
        setCheckedAt(new Date());
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    const requestSequence = sequence;
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => { requestSequence.current++; clearInterval(timerRef.current); };
  }, [check]);

  return { state, health, checkedAt, checking, recheck: check };
}
