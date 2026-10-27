import { env } from "@/config/env";
import { clearAuthToken } from "@/services/authService";
import { handleAppUnauthorized } from "@/services/appSession";
import { handleUserUnauthorized } from "@/services/userAuthService";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** `true` remains admin auth for backwards compatibility. */
  auth?: boolean | "app" | "admin" | "user";
  timeoutMs?: number;
  isFormData?: boolean;
}

// GEE-backed analysis endpoints (carbon/vegetation/landcover/disaster/timeseries)
// routinely take well over 30s for real compute - a flat 30s default caused
// "Request timed out" failures on ordinary, successful analyses (verified: a
// province-scale /analyze/carbon call took well over a minute end-to-end).
// Bumped to 3 minutes; fast endpoints (health, lists, config) return in
// milliseconds regardless, so this only changes how long a genuinely slow/
// hung request is given before erroring out.
const DEFAULT_TIMEOUT_MS = 180_000;

let onUnauthorized: (() => void) | null = null;

/** Registered once by the auth store/guard so 401s can trigger a global logout redirect. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function formatErrorValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const messages = value.map((item) => formatErrorValue(item)).filter((item): item is string => Boolean(item));
    return messages.length ? messages.join("; ") : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const message = formatErrorValue(record.message) ?? formatErrorValue(record.error);
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.map((reason) => formatErrorValue(reason) ?? String(reason)).filter(Boolean)
    : [];
  if (message && reasons.length) return `${message}: ${reasons.join("; ")}`;
  if (message) return message;
  if (reasons.length) return reasons.join("; ");
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function formatApiErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "string") {
    const plainText = payload
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (plainText) return plainText.slice(0, 500);
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      const message = formatErrorValue(record[key]);
      if (message) return message;
    }
  }
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    auth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    isFormData,
    headers,
    signal: callerSignal,
    ...rest
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // A caller-owned signal cancels this request without being reported as a timeout.
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (!isFormData && body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      ...rest,
      headers: finalHeaders,
      credentials: "include",
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
    if ((err as Error).name === "AbortError") {
      if (callerSignal?.aborted) throw new DOMException("Request aborted", "AbortError");
      throw new ApiError("Request timed out", 0);
    }
    throw new ApiError("Network error - backend unreachable", 0);
  }
  clearTimeout(timeout);
  callerSignal?.removeEventListener("abort", abortFromCaller);

  if (res.status === 401 && auth) {
    if (auth === "app") {
      handleAppUnauthorized();
    } else if (auth === "user") {
      handleUserUnauthorized();
    } else if (auth === true || auth === "admin") {
      clearAuthToken();
      onUnauthorized?.();
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const parsed = (contentType.includes("application/json") || contentType.includes("+json"))
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const message = formatApiErrorMessage(parsed, res.status);
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: formData, isFormData: true }),
};
