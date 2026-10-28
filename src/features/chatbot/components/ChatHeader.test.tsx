import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatHeader from "./ChatHeader";

afterEach(cleanup);

const base = { status: "Siap membantu analisis", onHistoryClick: vi.fn(), onNewChatClick: vi.fn(), onCloseClick: vi.fn() };

describe("SaveGeo Assistant header", () => {
  it("keeps provider and model details out of the chat popup", () => {
    render(<ChatHeader {...base} aoiName="KOTA SEMARANG" period="2026" />);

    expect(screen.getByText("SaveGeo Assistant")).toBeTruthy();
    expect(screen.getByText("KOTA SEMARANG")).toBeTruthy();
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.queryByText(/OpenRouter|Ollama|openai\//i)).toBeNull();
    expect(screen.queryByLabelText("Pilih model AI")).toBeNull();
  });
});
