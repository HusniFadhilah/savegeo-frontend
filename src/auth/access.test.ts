import { describe, expect, it } from "vitest";
import { canAccessAdminSection, getDashboardEntryPath, hasAdminPermission, isViewerRole } from "./access";

describe("isViewerRole", () => {
  it("recognizes the explicit viewer flag regardless of role name", () => {
    expect(isViewerRole({ is_viewer: true })).toBe(true);
    expect(isViewerRole({ is_viewer: true })).toBe(true);
  });

  it("does not classify other or missing roles as viewer", () => {
    expect(isViewerRole({ is_viewer: false })).toBe(false);
    expect(isViewerRole(null)).toBe(false);
    expect(isViewerRole(undefined)).toBe(false);
  });
});

describe("getDashboardEntryPath", () => {
  it("sends viewer accounts to the regular dashboard", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: true, isUserAuthenticated: false, adminRole: "renamed-viewer", adminIsViewer: true })).toBe("/carbon-estimation");
  });

  it("keeps non-viewer admin accounts in the admin dashboard", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: true, isUserAuthenticated: true, adminRole: "administrator" })).toBe("/admin");
  });

  it("sends public app users to the regular dashboard and signed-out users to login", () => {
    expect(getDashboardEntryPath({ isAdminAuthenticated: false, isUserAuthenticated: true })).toBe("/carbon-estimation");
    expect(getDashboardEntryPath({ isAdminAuthenticated: false, isUserAuthenticated: false })).toBe("/login");
  });
});

describe("geospatial expert permissions", () => {
  const expert = {
    role: "geospatial_expert",
    permissions: [
      "company.read",
      "company.write",
      "disaster.read",
      "model.read",
      "model.write",
      "geospatial.read",
      "geospatial.write",
    ],
  };

  it("allows spatial work while denying sensitive administration", () => {
    expect(hasAdminPermission(expert, "company.write")).toBe(true);
    expect(hasAdminPermission(expert, "model.write")).toBe(true);
    expect(hasAdminPermission(expert, "credential.write")).toBe(false);
    expect(hasAdminPermission(expert, "users.write")).toBe(false);
  });

  it("exposes only the allowed admin sections", () => {
    expect(canAccessAdminSection(expert, "ov")).toBe(false);
    expect(canAccessAdminSection(expert, "co")).toBe(true);
    expect(canAccessAdminSection(expert, "ds")).toBe(true);
    expect(canAccessAdminSection(expert, "gd")).toBe(true);
    expect(canAccessAdminSection(expert, "ml")).toBe(true);
    expect(canAccessAdminSection(expert, "us")).toBe(false);
    expect(canAccessAdminSection(expert, "ge")).toBe(false);
  });
});

describe("explicit admin permissions", () => {
  const admin = { role: "admin", permissions: ["config.read", "model.read", "model.write"] };

  it("allows non-secret administration but denies credential and secret access", () => {
    expect(hasAdminPermission(admin, "config.read")).toBe(true);
    expect(hasAdminPermission(admin, "model.write")).toBe(true);
    expect(hasAdminPermission(admin, "credential.read")).toBe(false);
    expect(hasAdminPermission(admin, "secret.read")).toBe(false);
  });
});

describe("explicit full access", () => {
  it("denies missing role and missing flag", () => {
    expect(hasAdminPermission({ role: null }, "secret.write")).toBe(false);
    expect(hasAdminPermission({ role: null, is_superuser: false }, "secret.write")).toBe(false);
    expect(hasAdminPermission({ role: null, is_superuser: true }, "secret.write")).toBe(true);
    expect(hasAdminPermission({ role: "renamed", is_viewer: true, permissions: ["secret.write"] }, "secret.write")).toBe(false);
  });
});
