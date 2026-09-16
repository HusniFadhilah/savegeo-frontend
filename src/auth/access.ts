export function isViewerRole(role?: string | null): boolean {
  return role?.trim().toLowerCase() === "viewer";
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
