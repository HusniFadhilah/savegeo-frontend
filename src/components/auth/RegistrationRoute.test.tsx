import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegistrationRoute from "./RegistrationRoute";

vi.mock("@/pages/RegisterUserPage", () => ({ default: () => <div>Registration form</div> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function showRoute() {
  render(<MemoryRouter initialEntries={["/register"]}><Routes><Route path="/register" element={<RegistrationRoute />} /><Route path="/login" element={<div>Login destination</div>} /></Routes></MemoryRouter>);
}
it("redirects when server registration is closed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ registration_enabled: false }), { headers: { "content-type": "application/json" } })));
  showRoute();
  expect(await screen.findByText("Login destination")).toBeTruthy();
  expect(screen.queryByText("Registration form")).toBeNull();
});
it("shows registration only when the server explicitly enables it", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ registration_enabled: true }), { headers: { "content-type": "application/json" } })));
  showRoute();
  expect(await screen.findByText("Registration form")).toBeTruthy();
});
it("keeps registration closed when configuration cannot be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  showRoute();
  expect(await screen.findByText("Login destination")).toBeTruthy();
});
