import { describe, expect, it } from "vitest";
import { getDashboardEntryPath, isViewerRole } from "./access";

describe("isViewerRole", () => {
  it("recognizes viewer regardless of casing and whitespace", () => {
    expect(isViewerRole(" viewer ")).toBe(true);
    expect(isViewerRole("VIEWER")).toBe(true);
  });

  it("does not classify other or missing roles as viewer", () => {
    expect(isViewerRole("administrator")).toBe(false);
    expect(isViewerRole(null)).toBe(false);
    expect(isViewerRole(undefined)).toBe(false);
  });
});

describe("getDashboardEntryPath", () => {
  it("sends viewer accounts to the regular dashboard", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: true, isUserAuthenticated: false, adminRole: "viewer" })).toBe("/carbon-estimation");
  });

  it("keeps non-viewer admin accounts in the admin dashboard", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: true, isUserAuthenticated: true, adminRole: "administrator" })).toBe("/admin");
  });

  it("sends public app users to the regular dashboard and signed-out users to login", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: false, isUserAuthenticated: true })).toBe("/carbon-estimation");
    expect(getDashboardEntryPath({ isAdminAuthenticated: false, isUserAuthenticated: false })).toBe("/login");
  });
});
