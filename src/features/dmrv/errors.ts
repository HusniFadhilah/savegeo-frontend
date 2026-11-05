import { ApiError } from "@/services/apiClient";
import { dmrvErrorCode } from "./api";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** User-facing text for a failed dMRV call: server `code: message` when present, else a generic line. */
export function describeDmrvError(error: unknown, t: Translate): string {
  const code = dmrvErrorCode(error);
  if (code && error instanceof ApiError) {
    const payload = error.payload as { message?: unknown };
    const message = typeof payload.message === "string" ? payload.message : error.message;
    return t("dmrv.errors.withCode", { code, message });
  }
  if (error instanceof ApiError && error.message) return error.message;
  return t("dmrv.errors.generic");
}
