import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { authService } from "@/services/authService";
import MfaLoginPanel from "./MfaLoginPanel";

vi.mock("@/services/authService", () => ({ authService: { login: vi.fn(), me: vi.fn().mockRejectedValue(new Error("No session")), logout: vi.fn(), verifyMfa: vi.fn(), mfaEnrollment: vi.fn() } }));
const challenge = { mfa_required: true as const, challenge: "private-challenge", enrollment_required: true, expires_in: 300 };
beforeEach(async () => {
  await Promise.resolve();
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, error: null, mfaChallenge: null, recoveryCodes: [] });
});
afterEach(cleanup);

it("does not treat a pending challenge as an authenticated login", async () => {
  vi.mocked(authService.login).mockResolvedValue(challenge);
  expect(await useAuthStore.getState().login("admin", "password")).toBe(false);
  expect(useAuthStore.getState().mfaChallenge).toEqual(challenge);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(authService.me).not.toHaveBeenCalled();
});

it("shows recovery codes once and waits for acknowledgement before redirecting", async () => {
  useAuthStore.setState({ mfaChallenge: challenge });
  vi.mocked(authService.mfaEnrollment).mockResolvedValue({ secret: "PUBLIC-TEST-FIXTURE", provisioning_uri: "otpauth://fixture" });
  vi.mocked(authService.verifyMfa).mockResolvedValue({ user: { username: "admin" }, recovery_codes: ["one-time-recovery-fixture"] });
  vi.mocked(authService.me).mockResolvedValue({ username: "admin" });
  render(<MfaLoginPanel />);
  expect(await screen.findByDisplayValue("PUBLIC-TEST-FIXTURE")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Kode authenticator atau kode pemulihan"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verifikasi" }));
  expect(await screen.findByText("one-time-recovery-fixture")).toBeInTheDocument();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(screen.getByRole("button", { name: "Lanjutkan" })).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Saya sudah menyimpan kode pemulihan."));
  fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));
  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  expect(useAuthStore.getState().recoveryCodes).toEqual([]);
});
