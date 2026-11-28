import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { saveRecord } from "./api";
import OperationsPanel from "./OperationsPanel";

vi.mock("./api", async (original) => ({
  ...await original<typeof import("./api")>(),
  saveRecord: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(saveRecord).mockResolvedValue({} as Awaited<ReturnType<typeof saveRecord>>);
});
afterEach(cleanup);

it("saves an attributed operations entry through the existing versioned record API", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(
    <OperationsPanel
      projectId="project-1"
      records={[]}
      documents={[]}
      canWrite
      canReview={false}
      onChanged={onChanged}
    />,
  );

  fireEvent.change(screen.getByLabelText("Kunci catatan"), { target: { value: "partner-follow-up-1" } });
  fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Diskusi calon mitra" } });
  fireEvent.change(screen.getByLabelText("Sumber"), { target: { value: "Notula pertemuan" } });
  fireEvent.change(screen.getByLabelText("Pemilik tindak lanjut"), { target: { value: "Analis proyek" } });
  fireEvent.change(screen.getByLabelText("Ringkasan"), { target: { value: "Kirim ringkasan metodologi setelah pertemuan." } });
  fireEvent.click(screen.getByRole("button", { name: "Simpan draft" }));

  await waitFor(() => expect(saveRecord).toHaveBeenCalledWith(
    "project-1",
    "operations",
    "partner-follow-up-1",
    expect.objectContaining({
      title: "Diskusi calon mitra",
      status: "draft",
      payload: expect.objectContaining({
        record_type: "case_study",
        source: "Notula pertemuan",
        owner: "Analis proyek",
        record_status: "planned",
        evidence: [],
      }),
    }),
    0,
  ));
  expect(onChanged).toHaveBeenCalledOnce();
});
