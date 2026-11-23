// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import FieldValidationPlot from "./FieldValidationPlot";
import { useI18nStore } from "@/hooks/useI18nStore";

afterEach(cleanup);
beforeEach(() => useI18nStore.getState().setLanguage("id"));
describe("field validation diagnostics", () => {
  it("does not present uncomputed calibration as an independent validation result", () => {
    render(<FieldValidationPlot baseline={{ status: "computed", rows: [{ plot_id: "P1", observed: 2, predicted: 3 }] }} corrected={{ status: "not_computed" }} independent={false} />);
    expect(screen.getByText(/Kalibrasi belum dapat dihitung/)).toBeTruthy();
    expect(screen.queryByText("Setelah kalibrasi")).toBeNull();
    expect(screen.getByText(/data kalibrasi/)).toBeTruthy();
  });
  it("bounds SVG density while retaining a clear full-statistics notice", () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ plot_id: String(i), observed: i, predicted: i + 1 }));
    const { container } = render(<FieldValidationPlot baseline={{ status: "computed", rows }} corrected={{ status: "computed", rows }} independent />);
    expect(container.querySelectorAll("circle").length).toBeLessThanOrEqual(2000);
    expect(screen.getByText(/statistik dan unduhan JSON tetap mencakup semua plot/)).toBeTruthy();
    expect(screen.getByText(/tidak digunakan untuk menghitung koefisien kalibrasi/)).toBeTruthy();
  });
});
