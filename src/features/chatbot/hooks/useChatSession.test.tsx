import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { CHAT_I18N } from "../i18n";

const api = vi.hoisted(() => ({
  fetchPublicConfig: vi.fn(),
  fetchSessions: vi.fn(),
}));

vi.mock("../api", () => ({
  chatbotApi: {
    fetchPublicConfig: api.fetchPublicConfig,
    fetchSessions: api.fetchSessions,
  },
}));

import { useChatSession } from "./useChatSession";

describe("chat session history failures", () => {
  beforeEach(() => {
    useI18nStore.getState().setLanguage("id");
    api.fetchPublicConfig.mockResolvedValue({});
    api.fetchSessions.mockRejectedValue(new TypeError("network unavailable"));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a retryable history error when the session request fails", async () => {
    const { result } = renderHook(() => useChatSession());

    await waitFor(() => expect(result.current.sessionError).toBe(CHAT_I18N.id.historyLoadFailed));
    expect(result.current.sessions).toEqual([]);
    expect(result.current.historyRetry).toBe(CHAT_I18N.id.historyRetry);
  });

  it("clears the error when a manual retry succeeds", async () => {
    api.fetchSessions.mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useChatSession());
    await waitFor(() => expect(result.current.sessionError).toBe(CHAT_I18N.id.historyLoadFailed));

    await act(async () => {
      await result.current.refetchSessions();
    });

    expect(result.current.sessionError).toBeNull();
    expect(result.current.sessions).toEqual([]);
  });
});
