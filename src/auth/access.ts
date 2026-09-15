export function isViewerRole(role?: string | null): boolean {
  return role?.trim().toLowerCase() === "viewer";
}
