import { useEffect, useState, type FormEvent } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAdmin } from "../AdminContext";
import { updateAdminProfile } from "../api";
import PasswordChange from "./PasswordChange";

export default function AdminProfile() {
  const user = useAuthStore((state) => state.user);
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setEmail(user?.email ?? "");
  }, [user?.username, user?.email]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    if (!cleanUsername) {
      setError(t("admin.profile.usernameRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await updateAdminProfile({ username: cleanUsername, email: cleanEmail || null });
      useAuthStore.setState({ user: response.user });
      notify(t("admin.profile.saved"), "s");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("admin.profile.saveFailed");
      setError(message);
      notify(message, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-profile-page">
      <section className="card">
        <div className="card-header-custom">
          <span><i className="bi bi-person-vcard me-2" />{t("admin.profile.detailsTitle")}</span>
        </div>
        <div className="card-body-custom">
          <form onSubmit={(event) => void saveProfile(event)}>
            <div className="two-col">
              <div className="form-field">
                <label className="form-label" htmlFor="admin-profile-username">{t("admin.profile.username")}</label>
                <input
                  id="admin-profile-username"
                  className="form-input"
                  autoComplete="username"
                  maxLength={64}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="admin-profile-email">{t("admin.profile.email")}</label>
                <input
                  id="admin-profile-email"
                  className="form-input"
                  type="email"
                  autoComplete="email"
                  maxLength={128}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <small className="text-muted">{t("admin.profile.emailHint")}</small>
              </div>
            </div>
            {error && <div className="alert alert-danger py-2 px-3 mt-2" role="alert">{error}</div>}
            <button type="submit" className="btn-sm primary mt-2" disabled={saving}>
              <i className={`bi ${saving ? "bi-arrow-repeat spin" : "bi-check2"} me-1`} />
              {saving ? t("admin.profile.saving") : t("admin.profile.save")}
            </button>
          </form>
        </div>
      </section>

      <section className="card mt-3">
        <div className="card-header-custom">
          <span><i className="bi bi-shield-lock me-2" />{t("admin.profile.securityTitle")}</span>
        </div>
        <div className="card-body-custom">
          <p className="text-muted mb-2">{t("admin.profile.passwordHint")}</p>
          <button
            type="button"
            className="btn-sm"
            onClick={() => setPasswordFormOpen((open) => !open)}
            aria-expanded={passwordFormOpen}
          >
            <i className="bi bi-key me-1" />{t("admin.profile.changePassword")}
          </button>
          <PasswordChange open={passwordFormOpen} onOpenChange={setPasswordFormOpen} />
        </div>
      </section>
    </div>
  );
}
