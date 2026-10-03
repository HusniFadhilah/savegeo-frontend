import { useState } from "react";
import { changePassword } from "../api";
import { useAdmin } from "../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fully controlled — the "Ganti password" trigger button lives in the
 * profile page owns the trigger and visibility state. */
export default function PasswordChange({ open, onOpenChange }: Props) {
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    setError(null);
  };

  const handleSave = async () => {
    if (!oldPw || !newPw) {
      setError(t("admin.profile.passwordRequired"));
      return;
    }
    if (newPw.length < 8) {
      setError(t("admin.profile.passwordTooShort"));
      return;
    }
    if (newPw !== confirmPw) {
      setError(t("admin.profile.passwordMismatch"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(oldPw, newPw);
      notify(t("admin.profile.passwordSaved"), "s");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.profile.passwordFailed");
      setError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`collapse-form ${open ? "open" : ""}`} style={{ marginTop: "0.5rem" }}>
        <div style={{ maxWidth: 320 }}>
          <div className="form-field">
            <label className="form-label">{t("admin.profile.oldPassword")}</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.profile.newPassword")}</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.profile.confirmPassword")}</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-danger py-1 px-2 small">{error}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSave}>
              {saving ? t("admin.profile.passwordSaving") : t("admin.profile.passwordSave")}
            </button>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              {t("admin.profile.passwordCancel")}
            </button>
          </div>
        </div>
      </div>
  );
}
