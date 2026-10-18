import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatHeader from "./ChatHeader";
import type { AiCatalog } from "../types";

afterEach(cleanup);

const catalog: AiCatalog = {
  active: { provider: "openrouter", model: "openai/gpt-4o" },
  selectable: true,
  fallback: null,
  providers: [
    {
      id: "openrouter:openai/gpt-4o", provider: "openrouter", label: "OpenRouter", model: "openai/gpt-4o",
      is_default: true, is_fallback: false, status: "ok", available: true, tool_calling: true,
      latency_ms: 120, message: "Siap digunakan.",
    },
    {
      id: "ollama:qwen3:8b", provider: "ollama", label: "Ollama (lokal)", model: "qwen3:8b",
      is_default: false, is_fallback: false, status: "unreachable", available: false, tool_calling: null,
      latency_ms: null, message: "Server provider tidak dapat dijangkau.",
    },
  ],
};

const base = { status: "ok", onHistoryClick: vi.fn(), onNewChatClick: vi.fn(), onCloseClick: vi.fn() };

describe("model selector", () => {
  it("lists providers, disables an unavailable Ollama and shows why", () => {
    render(<ChatHeader {...base} aiCatalog={catalog} selectedAiId={null} onSelectAi={vi.fn()} />);
    const ollama = screen.getByRole("option", { name: /Ollama/ }) as HTMLOptionElement;
    expect(ollama.disabled).toBe(true);
    expect(ollama.textContent).toContain("tidak dapat dijangkau");
    expect(screen.getByText("siap")).toBeTruthy();
  });

  it("reports the chosen model and never renders URLs or keys", () => {
    const onSelectAi = vi.fn();
    const { container } = render(
      <ChatHeader {...base} aiCatalog={{ ...catalog, providers: catalog.providers.map((p) => ({ ...p, available: true, status: "ok" })) }} selectedAiId={null} onSelectAi={onSelectAi} />,
    );
    fireEvent.change(screen.getByLabelText("Pilih model AI"), { target: { value: "ollama:qwen3:8b" } });
    expect(onSelectAi).toHaveBeenCalledWith("ollama:qwen3:8b");
    expect(container.textContent).not.toMatch(/https?:\/\/|sk-/);
  });

  it("is a plain label when only the admin default is offered, and flags fallback usage", () => {
    render(
      <ChatHeader
        {...base}
        aiCatalog={{ ...catalog, selectable: false, providers: [catalog.providers[0]] }}
        selectedAiId={null}
        lastAi={{ provider: "openrouter", model: "openai/gpt-4o", fallback_used: true, fallback_from: "ollama" }}
        onSelectAi={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Pilih model AI")).toBeNull();
    expect(screen.getByText(/cadangan: openrouter/)).toBeTruthy();
  });
});
