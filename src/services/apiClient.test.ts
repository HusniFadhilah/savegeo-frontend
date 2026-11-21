import { afterEach, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps private server errors out of the displayed message", async () => {
  const payload = { detail: "private-upstream-key", request_id: "audit-request.1" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 503, headers: { "content-type": "application/problem+json" } })));
  await expect(apiClient.get("/analysis-jobs/example")).rejects.toMatchObject({
    status: 503, message: "Server temporarily unavailable (audit-request.1)", payload,
  });
});

it("preserves plain-text API errors instead of replacing them with a generic status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response("Bad Request: unsupported analysis job type", {
      status: 400,
      headers: { "content-type": "text/plain" },
    }),
  ));

  await expect(apiClient.post("/analysis-jobs", { type: "carbon", payload: {} }))
    .rejects.toMatchObject({ status: 400, message: "Bad Request: unsupported analysis job type" });
});

it("extracts a concise message from an HTML proxy error page", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response("<html><body><h1>400 Bad Request</h1></body></html>", {
      status: 400,
      headers: { "content-type": "text/html" },
    }),
  ));

  await expect(apiClient.post("/analysis-jobs", { type: "carbon", payload: {} }))
    .rejects.toMatchObject({ status: 400, message: "400 Bad Request" });
});

it("keeps typed error codes but omits submitted values and internal details", async () => {
  const payload = {
    code: "invalid_aoi",
    detail: [{ loc: ["body", "aoi"], msg: "AOI tidak valid", input: "private-coordinate", ctx: { path: "C:\\private\\file" } }],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
    status: 422,
    headers: { "content-type": "application/problem+json" },
  })));

  await expect(apiClient.post("/analysis-jobs", { type: "carbon", payload: {} }))
    .rejects.toMatchObject({ status: 422, code: "invalid_aoi", message: "AOI tidak valid" });
});

it("redacts credential-like values from client-visible error messages", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ detail: "token=secret-value" }),
    { status: 400, headers: { "content-type": "application/problem+json" } },
  )));

  await expect(apiClient.post("/analysis-jobs", { type: "carbon", payload: {} }))
    .rejects.toMatchObject({ status: 400, message: "token=[redacted]" });
});
