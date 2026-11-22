import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import SnapshotValues from "./SnapshotValues";
afterEach(cleanup);
it("paginates and searches stored records while preserving original row numbers", () => {
  useI18nStore.getState().setLanguage("id");
  render(
    <SnapshotValues
      value={Array.from({ length: 45 }, (_, i) => ({ region: `Region-${i}`, area: i }))}
    />,
  );
  expect(screen.getAllByRole("row")).toHaveLength(21);
  expect(screen.queryByText("Region-20")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
  expect(screen.getByText("Region-20")).toBeInTheDocument();
  expect(within(screen.getAllByRole("row")[1]).getByRole("rowheader")).toHaveTextContent("21");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Region-44" } });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("rowheader")).toHaveTextContent("45");
  expect(screen.queryByRole("button", { name: "Berikutnya" })).not.toBeInTheDocument();
});
it("retains zero and displays missing data explicitly", () => {
  useI18nStore.getState().setLanguage("id");
  render(<SnapshotValues value={{ mean: 0, missing: null, included: false }} />);
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.getByText("Tidak tersedia")).toBeInTheDocument();
  expect(screen.getByText("Tidak")).toBeInTheDocument();
});
