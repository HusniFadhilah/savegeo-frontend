import { env } from "@/config/env";
import { clearAuthToken } from "@/services/authService";
import { handleAppUnauthorized } from "@/services/appSession";
import { handleUserUnauthorized } from "@/services/userAuthService";
import { useI18nStore } from "@/hooks/useI18nStore";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  code?: string;

  constructor(message: string, status: number, payload?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** `true` remains admin auth for backwards compatibility. */
  auth?: boolean | "app" | "admin" | "user";
  timeoutMs?: number;
  isFormData?: boolean;
  responseType?: "json" | "blob";
}

// GEE-backed analysis endpoints (carbon/vegetation/landcover/disaster/timeseries)
// routinely take well over 30s for real compute - a flat 30s default caused
// "Request timed out" failures on ordinary, successful analyses (verified: a
// province-scale /analyze/carbon call took well over a minute end-to-end).
// Bumped to 3 minutes; fast endpoints (health, lists, config) return in
// milliseconds regardless, so this only changes how long a genuinely slow/
// hung request is given before erroring out.
const DEFAULT_TIMEOUT_MS = 180_000;

const API_ERROR_TRANSLATION_KEYS: Record<string, string> = {
  bad_request: "errors.api.badRequest",
  validation_error: "errors.api.validation",
  unauthorized: "errors.api.unauthorized",
  forbidden: "errors.api.forbidden",
  not_found: "errors.api.notFound",
  conflict: "errors.api.conflict",
  payload_too_large: "errors.api.payloadTooLarge",
  rate_limited: "errors.api.rateLimited",
  internal_error: "errors.api.serverUnavailable",
  upstream_error: "errors.api.upstreamUnavailable",
  service_unavailable: "errors.api.serverUnavailable",
  upstream_timeout: "errors.api.timeout",
};

let onUnauthorized: (() => void) | null = null;

/** Registered once by the auth store/guard so 401s can trigger a global logout redirect. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function sanitizeErrorText(value: string): string | null {
  const safe = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:postgres(?:ql)?|mysql|redis):\/\/[^\s"'<>]+/gi, "[connection string]")
    .replace(/\b(api[_-]?key|token|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]\s*["']?[^\s,;"']+/gi, "$1=[redacted]")
    .replace(/(?:[A-Za-z]:\\|\/(?:home|app|workspace|var|tmp)\/)[^\s"'<>]+/g, "[server path]")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return safe ? safe.slice(0, 500) : null;
}

function formatErrorValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return sanitizeErrorText(value);
  if (Array.isArray(value)) {
    const messages = value.map((item) => formatErrorValue(item)).filter((item): item is string => Boolean(item));
    return messages.length ? messages.join("; ") : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const message = formatErrorValue(record.message) ?? formatErrorValue(record.error) ?? formatErrorValue(record.msg);
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.map((reason) => formatErrorValue(reason) ?? String(reason)).filter(Boolean)
    : [];
  if (message && reasons.length) return `${message}: ${reasons.join("; ")}`;
  if (message) return message;
  if (reasons.length) return reasons.join("; ");
  // Never serialize unknown error objects: validation payloads can include
  // submitted input, environment details, paths, or provider responses.
  return null;
}

function translatedErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const detail = record.detail && typeof record.detail === "object"
    ? record.detail as Record<string, unknown> : null;
  const code = [record.code, detail?.code].find((value): value is string =>
    typeof value === "string" && /^[a-z0-9_]{1,80}$/i.test(value),
  );
  const key = code ? API_ERROR_TRANSLATION_KEYS[code] : undefined;
  return key ? useI18nStore.getState().t(key) : null;
}

export function formatApiErrorMessage(payload: unknown, status: number): string {
  if (status >= 500) {
    const translated = translatedErrorCode(payload) ?? useI18nStore.getState().t("errors.api.serverUnavailable");
    const requestId = payload && typeof payload === "object" && "request_id" in payload
      ? (payload as Record<string, unknown>).request_id : undefined;
    const reference = typeof requestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
      ? ` (${requestId})` : "";
    return `${translated}${reference}`;
  }
  const translated = translatedErrorCode(payload);
  if (translated) return translated;
  if (typeof payload === "string") {
    const plainText = sanitizeErrorText(payload);
    if (plainText) return plainText;
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
    responseType = "json",
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
  const parsed = res.ok && responseType === "blob"
    ? await res.blob()
    : (contentType.includes("application/json") || contentType.includes("+json"))
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const message = formatApiErrorMessage(parsed, res.status);
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    const detail = record?.detail && typeof record.detail === "object"
      ? record.detail as Record<string, unknown> : null;
    const code = [record?.code, detail?.code].find((value): value is string =>
      typeof value === "string" && /^[A-Z0-9_.:-]{1,80}$/i.test(value),
    );
    throw new ApiError(message, res.status, parsed, code);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  getBlob: (path: string, options?: RequestOptions) => request<Blob>(path, { ...options, responseType: "blob", method: "GET" }),
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
