export function isViewerRole(account?: { is_viewer?: boolean } | null): boolean {
  return account?.is_viewer === true;
}

export type AdminPermission = string;

/** Only explicit superuser status or a returned permission grants access. */
export function hasAdminPermission(
  user: { role?: string | null; permissions?: string[] | null; is_superuser?: boolean; is_viewer?: boolean } | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!user || isViewerRole(user)) return false;
  if (user.is_superuser === true) return true;
  return user.permissions?.includes(permission) ?? false;
}

export const ADMIN_SECTION_PERMISSIONS: Record<string, string> = {
  ov: "config.read",
  ge: "credential.read",
  ag: "credential.read",
  ml: "model.read",
  cc: "calibration.read",
  bc: "config.read",
  cf: "config.read",
  us: "users.read",
  vf: "viewer_features.manage",
  sp: "satellite.read",
  co: "company.read",
  ds: "disaster.read",
  gd: "geospatial.read",
  ri: "audit.read",
};

export function canAccessAdminSection(
  user: { role?: string | null; permissions?: string[] | null; is_superuser?: boolean; is_viewer?: boolean } | null | undefined,
  section: string,
): boolean {
  if (section === "profile") return Boolean(user && !isViewerRole(user));
  const permission = ADMIN_SECTION_PERMISSIONS[section];
  return permission ? hasAdminPermission(user, permission) : false;
}

export function firstAccessibleAdminSection(
  user: { role?: string | null; permissions?: string[] | null; is_superuser?: boolean; is_viewer?: boolean } | null | undefined,
): string | null {
  const preferred = ["co", "ds", "gd", "ml", "ov", "ge", "ag", "bc", "cf", "us", "vf", "sp", "ri"];
  return [...preferred, "profile"].find((section) => canAccessAdminSection(user, section)) ?? null;
}

export function getDashboardEntryPath(params: {
  isAdminAuthenticated: boolean;
  isUserAuthenticated: boolean;
  adminRole?: string | null;
  adminIsViewer?: boolean;
}): string {
  if (!params.isAdminAuthenticated && !params.isUserAuthenticated) return "/login";
  if (params.isAdminAuthenticated && !params.adminIsViewer) return "/admin";
  return "/carbon-estimation";
}
