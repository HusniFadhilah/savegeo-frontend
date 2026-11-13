import { useEffect, useState, type FormEvent } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { authService } from "@/services/authService";

export default function MfaLoginPanel() {
  const { mfaChallenge, recoveryCodes, isLoading, error, verifyMfa, finishMfa, cancelMfa } =
    useAuthStore();
  const en = useI18nStore((state) => state.language === "en");
  const tr = (id: string, english: string) => (en ? english : id);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => {
    let active = true;
    setSecret("");
    setCode("");
    setSetupError("");
    if (mfaChallenge?.enrollment_required) {
      setSettingUp(true);
      authService
        .mfaEnrollment(mfaChallenge.challenge)
        .then((result) => {
          if (active) setSecret(result.secret);
        })
        .catch((cause: unknown) => {
          if (active) setSetupError(cause instanceof Error ? cause.message : "Enrollment failed");
        })
        .finally(() => {
          if (active) setSettingUp(false);
        });
    }
    return () => {
      active = false;
    };
  }, [mfaChallenge]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void verifyMfa(code.trim()).then((ok) => {
      if (ok) setCode("");
    });
  }

  if (recoveryCodes.length > 0)
    return (
      <section aria-labelledby="mfa-recovery-title">
        <h2 id="mfa-recovery-title" className="h5">
          {tr("Simpan kode pemulihan", "Save recovery codes")}
        </h2>
        <p className="small">
          {tr(
            "Kode ini hanya ditampilkan sekali. Setiap kode berlaku satu kali. Simpan di tempat pribadi yang aman.",
            "These codes are shown once. Each code can be used once. Store them in a safe private place.",
          )}
        </p>
        <div className="row g-2 mb-3">
          {recoveryCodes.map((item) => (
            <div key={item} className="col-6">
              <code className="d-block border rounded p-2 text-body">{item}</code>
            </div>
          ))}
        </div>
        <div className="form-check mb-3">
          <input
            id="mfa-codes-saved"
            type="checkbox"
            className="form-check-input"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="mfa-codes-saved">
            {tr("Saya sudah menyimpan kode pemulihan.", "I have saved the recovery codes.")}
          </label>
        </div>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <button
          className="btn btn-success w-100"
          type="button"
          disabled={!saved || isLoading}
          onClick={() => void finishMfa()}
        >
          {tr("Lanjutkan", "Continue")}
        </button>
      </section>
    );

  return (
    <form onSubmit={submit}>
      <h2 className="h5">
        <i className="bi bi-shield-lock me-2" aria-hidden="true" />
        {tr("Verifikasi dua langkah", "Two-step verification")}
      </h2>
      {mfaChallenge?.enrollment_required && (
        <>
          <p className="small">
            {tr(
              "Tambahkan akun SAVEGEO pada aplikasi authenticator dengan kunci berikut, lalu masukkan kode enam digit.",
              "Add a SAVEGEO account in your authenticator app using this setup key, then enter its six-digit code.",
            )}
          </p>
          <label htmlFor="mfa-setup-secret" className="form-label">
            {tr("Kunci authenticator", "Authenticator setup key")}
          </label>
          <input
            id="mfa-setup-secret"
            className="form-control font-monospace mb-3"
            readOnly
            value={secret}
            autoComplete="off"
            onFocus={(event) => event.currentTarget.select()}
          />
        </>
      )}
      {settingUp && (
        <p role="status">{tr("Menyiapkan authenticator…", "Preparing authenticator…")}</p>
      )}
      {setupError && (
        <div className="alert alert-danger" role="alert">
          {setupError}
        </div>
      )}
      <label htmlFor="mfa-login-code" className="form-label">
        {tr("Kode authenticator atau kode pemulihan", "Authenticator or recovery code")}
      </label>
      <input
        id="mfa-login-code"
        className="form-control mb-3"
        autoComplete="one-time-code"
        maxLength={64}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-success w-100"
        disabled={isLoading || settingUp || Boolean(setupError)}
      >
        {isLoading ? tr("Memverifikasi…", "Verifying…") : tr("Verifikasi", "Verify")}
      </button>
      <button
        type="button"
        className="btn btn-link w-100 mt-2"
        disabled={isLoading}
        onClick={cancelMfa}
      >
        {tr("Kembali ke login", "Back to login")}
      </button>
    </form>
  );
}
