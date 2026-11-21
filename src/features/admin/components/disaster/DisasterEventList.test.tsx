import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDisasterEvents } from "../../api";
import type { DisasterEvent } from "../../types";
import DisasterEventList from "./DisasterEventList";

vi.mock("../../AdminContext", () => ({ useAdmin: () => ({ notify: vi.fn() }) }));
vi.mock("../../api", () => ({
  listDisasterEvents: vi.fn(),
  deleteDisasterEvent: vi.fn(),
  updateDisasterEvent: vi.fn(),
}));
vi.mock("@/components/ui/TablePagination", () => ({
  default: ({ onNext }: { onNext: () => void }) => <button onClick={onNext}>Halaman berikutnya</button>,
}));

const events: DisasterEvent[] = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1,
  name: `Kejadian ${index + 1}`,
  disaster_type: "flood",
  province: [],
  district: [],
  status: "draft",
}));

describe("disaster event table numbering", () => {
  beforeEach(() => {
    vi.mocked(listDisasterEvents).mockImplementation(async (params) => ({
      events: params?.search ? events.filter((event) => event.name === params.search) : events,
    }));
  });

  it("keeps numbers beside the checkbox across pages and resets after filtering", async () => {
    render(<DisasterEventList onCreateNew={vi.fn()} onEdit={vi.fn()} onOpen={vi.fn()} />);
    await screen.findByText("Kejadian 1");
    expect((screen.getByRole("columnheader", { name: "No." }) as HTMLTableCellElement).cellIndex).toBe(1);
    expect(within(screen.getByRole("row", { name: /Kejadian 1 Banjir/ })).getAllByRole("cell")[1]).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    expect(within(screen.getByRole("row", { name: /Kejadian 11 Banjir/ })).getAllByRole("cell")[1]).toHaveTextContent("11");

    fireEvent.change(screen.getByPlaceholderText("Cari nama, lokasi..."), { target: { value: "Kejadian 11" } });
    await waitFor(() => {
      expect(within(screen.getByRole("row", { name: /Kejadian 11 Banjir/ })).getAllByRole("cell")[1]).toHaveTextContent("1");
    });
  }, 20000);

  it("renders hostile event names as text rather than executable markup", async () => {
    const hostileName = '<img src=x onerror="alert(1)">';
    vi.mocked(listDisasterEvents).mockResolvedValueOnce({
      events: [{ ...events[0], name: hostileName }],
    });

    const { container } = render(<DisasterEventList onCreateNew={vi.fn()} onEdit={vi.fn()} onOpen={vi.fn()} />);
    await screen.findByText(hostileName);

    expect(container.querySelector("img, script, svg")).toBeNull();
    expect(container.textContent).toContain(hostileName);
  });
});
