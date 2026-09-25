export function isViewerRole(role?: string | null): boolean {
  return role?.trim().toLowerCase() === "viewer";
}

export type AdminPermission = string;

/**
 * Legacy admins with no assigned role are full-access by design. Explicit
 * roles are evaluated from the permission codes returned by /admin/auth/me.
 */
export function hasAdminPermission(
  user: { role?: string | null; permissions?: string[] | null } | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!user || isViewerRole(user.role)) return false;
  if (!user.role) return true;
  return user.permissions?.includes(permission) ?? false;
}

export const ADMIN_SECTION_PERMISSIONS: Record<string, string> = {
  ov: "config.read",
  ge: "credential.read",
  ag: "credential.read",
  ml: "model.read",
  cc: "calibration.read",
  cf: "config.read",
  us: "users.read",
  sp: "satellite.read",
  co: "company.read",
  ds: "disaster.read",
  gd: "geospatial.read",
  ri: "audit.read",
};

export function canAccessAdminSection(
  user: { role?: string | null; permissions?: string[] | null } | null | undefined,
  section: string,
): boolean {
  const permission = ADMIN_SECTION_PERMISSIONS[section];
  return permission ? hasAdminPermission(user, permission) : false;
}

export function firstAccessibleAdminSection(
  user: { role?: string | null; permissions?: string[] | null } | null | undefined,
): string | null {
  const preferred = ["co", "ds", "gd", "ml", "ov", "ge", "ag", "cf", "us", "sp", "ri"];
  return preferred.find((section) => canAccessAdminSection(user, section)) ?? null;
}

export function getDashboardEntryPath(params: {
  isAdminAuthenticated: boolean;
  isUserAuthenticated: boolean;
  adminRole?: string | null;
}): string {
  if (!params.isAdminAuthenticated && !params.isUserAuthenticated) return "/login";
  if (params.isAdminAuthenticated && !isViewerRole(params.adminRole)) return "/admin";
  return "/carbon-estimation";
}
