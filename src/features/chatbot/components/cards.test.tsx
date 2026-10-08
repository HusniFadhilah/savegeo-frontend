import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmActionCard } from "./cards";

afterEach(cleanup);
it("shows the actual backend error inside the failed confirmation card", () => {
  render(<ConfirmActionCard actions={[{ action: "run_analysis", target: "carbon.analysis" }]} status="failed" errorMessage="Tidak ada scene valid untuk AOI BALI dan periode ini." onRun={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole("alert").textContent).toBe("Tidak ada scene valid untuk AOI BALI dan periode ini.");
  expect(screen.queryByText("Selesai")).toBeNull();
});
