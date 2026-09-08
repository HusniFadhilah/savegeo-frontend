import { env } from "@/config/env";
import { clearAuthToken } from "@/services/authService";
import { handleAppUnauthorized } from "@/services/appSession";

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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS, isFormData, headers, ...rest } =
    options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Request timed out", 0);
    }
    throw new ApiError("Network error - backend unreachable", 0);
  }
  clearTimeout(timeout);

  if (res.status === 401 && auth) {
    if (auth === "app") {
      handleAppUnauthorized();
    } else if (auth === true || auth === "admin") {
      clearAuthToken();
      onUnauthorized?.();
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const parsed = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as Record<string, unknown>).message)
        : null) ||
      (parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as Record<string, unknown>).error)
        : null) ||
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as Record<string, unknown>).detail)
        : null) ||
      `Request failed with status ${res.status}`;
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
