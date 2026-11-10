// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FieldValidationPlot from "./FieldValidationPlot";

afterEach(cleanup);
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
    expect(screen.getByText(/statistik dan unduhan JSON tetap mencakup seluruh plot/)).toBeTruthy();
    expect(screen.getByText(/tidak dipakai untuk menghitung koefisien/)).toBeTruthy();
  });
});
