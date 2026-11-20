import { useEffect, useState, type FormEvent } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { userAuthService } from "@/services/userAuthService";
import { updateAdminName } from "@/features/admin/api";
import "./ProfilePage.css";

export default function ProfilePage() {
  const admin = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAuthenticated);
  const appUser = useUserAuthStore((s) => s.user);
  const user = isAdmin ? admin : appUser;
  const t = useI18nStore((s) => s.t);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setFullName(user?.full_name ?? ""); }, [user?.id, user?.full_name]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAdmin && !fullName.trim()) {
      setError(t("admin.users.nameRequired"));
      setMessage("");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      if (isAdmin) {
        const response = await updateAdminName(fullName);
        useAuthStore.setState({ user: response.user });
      } else {
        const response = await userAuthService.updateProfile(fullName);
        useUserAuthStore.setState({ user: response.user });
      }
      setMessage(t("admin.profile.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.profile.saveFailed"));
    } finally { setSaving(false); }
  }

  return <DashboardShell>
    <div className="profile-page">
      <section className="card profile-page__card">
        <div className="card-header profile-page__header"><h1 className="h5 mb-0">{t("account.profile")}</h1></div>
        <form className="card-body profile-page__form" onSubmit={(event) => void save(event)}>
          <div className="mb-3">
            <label className="form-label" htmlFor="profile-full-name">{t("account.fullName")}</label>
            <input id="profile-full-name" className="form-control" autoComplete="name" maxLength={160} required={isAdmin} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <small className="text-muted">{t("account.nameHint")}</small>
            {isAdmin && <small className="d-block text-muted">{t("admin.users.fullNameHint")}</small>}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="profile-username">{t("admin.profile.username")}</label>
            <input id="profile-username" className="form-control" readOnly value={user?.username ?? ""} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="profile-email">{t("admin.profile.email")}</label>
            <input id="profile-email" className="form-control" readOnly value={user?.email ?? ""} />
          </div>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}
          <button type="submit" className="btn btn-primary" disabled={saving}>{t(saving ? "admin.profile.saving" : "admin.profile.save")}</button>
        </form>
      </section>
    </div>
  </DashboardShell>;
}
