import { apiClient } from "@/services/apiClient";

const auth = { auth: "app" } as const;
export interface Organization {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  revision: number;
  personal: boolean;
}
export interface OrganizationMember {
  id: string;
  principal_type: "user" | "admin";
  username: string | null;
  full_name: string | null;
  role: Organization["role"];
  is_active: boolean;
}
export interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}
const base = (id: string) => `/organizations/${encodeURIComponent(id)}`;
export const listOrganizations = () => apiClient.get<Organization[]>("/organizations", auth);
export const createOrganization = (name: string, key: string) =>
  apiClient.post<Organization>(
    "/organizations",
    { name },
    { ...auth, headers: { "Idempotency-Key": key } },
  );
export const listOrganizationMembers = (id: string) =>
  apiClient.get<OrganizationMember[]>(`${base(id)}/members`, auth);
export const changeOrganizationMember = (
  id: string,
  memberId: string,
  role: Organization["role"],
  active: boolean,
) =>
  apiClient.patch<{ id: string; role: string; is_active: boolean }>(
    `${base(id)}/members/${encodeURIComponent(memberId)}`,
    { role, is_active: active },
    auth,
  );
export const listInvitations = (id: string) =>
  apiClient.get<Invitation[]>(`${base(id)}/invitations`, auth);
export const inviteMember = (id: string, email: string, role: "admin" | "member") =>
  apiClient.post<{ invitation: Invitation; token: string }>(
    `${base(id)}/invitations`,
    { email, role },
    auth,
  );
export const revokeInvitation = (id: string, inviteId: string) =>
  apiClient.delete<void>(`${base(id)}/invitations/${encodeURIComponent(inviteId)}`, auth);
export const acceptInvitation = (token: string) =>
  apiClient.post<Organization>("/organizations/invitations/accept", { token }, auth);
