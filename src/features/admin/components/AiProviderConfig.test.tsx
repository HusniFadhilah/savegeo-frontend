import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AiProviderConfig from "./AiProviderConfig";

vi.mock("../api", () => ({
  getOllamaModels: vi.fn().mockResolvedValue({ reachable: false, models: [], latency_ms: null, error: null, message: "tidak tersedia" }),
  getOpenRouterModels: vi.fn().mockResolvedValue({ models: [], error: null }),
}));

describe("AI cost controls", () => {
  it("edits the global daily budget and model-price JSON", () => {
    const onChange = vi.fn();
    render(
      <AiProviderConfig
        items={[
          { key: "ai.daily_budget_usd", label: "Plafon biaya AI harian", raw_value: "0", value_type: "float" },
          { key: "ai.model_pricing_json", label: "Harga model AI JSON", raw_value: "{}", value_type: "json" },
        ]}
        values={{ "ai.daily_budget_usd": "0", "ai.model_pricing_json": "{}" }}
        onChange={onChange}
        providerStatus={{}}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "20" } });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: '{"openai:gpt-4o":{"input_per_million_usd":2.5,"output_per_million_usd":10}}' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, "ai.daily_budget_usd", "20");
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      "ai.model_pricing_json",
      '{"openai:gpt-4o":{"input_per_million_usd":2.5,"output_per_million_usd":10}}',
    );
  });
});
