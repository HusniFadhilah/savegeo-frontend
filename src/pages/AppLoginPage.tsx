import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginIllustration from "@/components/auth/LoginIllustration";
import MfaLoginPanel from "@/components/auth/MfaLoginPanel";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { authService } from "@/services/authService";
import { userAuthService } from "@/services/userAuthService";
import { ApiError } from "@/services/apiClient";

function UnifiedAccessForm() {
  const c = useBilingualCopy();
  const userLogin = useUserAuthStore((state) => state.login);
  const userLoading = useUserAuthStore((state) => state.isLoading);
  const userError = useUserAuthStore((state) => state.error);
  const adminLogin = useAuthStore((state) => state.login);
  const adminLoading = useAuthStore((state) => state.isLoading);
  const adminError = useAuthStore((state) => state.error);
  const mfaChallenge = useAuthStore((state) => state.mfaChallenge);
  const recoveryCodes = useAuthStore((state) => state.recoveryCodes);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const isLoading = userLoading || adminLoading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const credentials = { username: username.trim(), password };
    // Try the privileged account first. A username may legally exist in both
    // auth tables, and resolving it as a public user would send an admin to
    // the public workspace instead of the admin dashboard.
    if (await adminLogin(credentials.username, credentials.password)) return;
    if (useAuthStore.getState().mfaChallenge) { setPassword(""); return; }
    if (await userLogin(credentials.username, credentials.password)) return;
    setFormError(
        useUserAuthStore.getState().error ||
        useAuthStore.getState().error ||
        c("Nama pengguna atau kata sandi tidak sesuai.", "Incorrect username or password."),
    );
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setResetMessage(null);
    setResetError(null);
    if (!identifier.trim()) {
      setResetError(c("Masukkan email atau nama pengguna.", "Enter an email address or username."));
      return;
    }
    setResetLoading(true);
    try {
      const result = await userAuthService.forgotPassword(identifier.trim());
      setResetMessage(result.message);
    } catch (userError) {
      try {
        const result = await authService.forgotPassword(identifier.trim());
        setResetMessage(result.message);
      } catch (adminError) {
        const error = adminError ?? userError;
        setResetError(error instanceof ApiError ? error.message : c("Gagal mengirim email untuk mengatur ulang kata sandi.", "Could not send the password reset email."));
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="app-login-form-card">
      <div className="app-login-form-heading">
        <span className="app-login-form-icon"><i className="bi bi-shield-lock" /></span>
        <div><h2>{c("Masuk ke SaveGeo", "Sign in to SaveGeo")}</h2><p>{c("Akses ruang kerja analitik dengan akun pengguna atau admin.", "Access the analytics workspace with a user or admin account.")}</p></div>
      </div>
      <div className="app-login-role-note"><i className="bi bi-shield-check" /> {c("Akses dan otorisasi mengikuti peran akun Anda.", "Access and authorization follow your account role.")}</div>
      {mfaChallenge || recoveryCodes.length > 0 ? <MfaLoginPanel /> : forgotMode ? (
        <form onSubmit={submitForgot}>
          <label className="app-login-label" htmlFor="unified-reset-identifier">{c("Email atau nama pengguna", "Email or username")}</label>
          <input id="unified-reset-identifier" className="app-login-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
          {resetError && <div className="app-login-error">{resetError}</div>}
          {resetMessage && <div className="app-login-success">{resetMessage}</div>}
          <button className="app-login-submit" type="submit" disabled={resetLoading}>{resetLoading ? c("Mengirim...", "Sending...") : c("Kirim Tautan Pengaturan Ulang", "Send Reset Link")}</button>
          <button className="app-login-text-button" type="button" onClick={() => setForgotMode(false)}>{c("Kembali ke halaman masuk", "Back to sign in")}</button>
        </form>
      ) : (
        <form onSubmit={submit}>
          <label className="app-login-label" htmlFor="unified-username">{c("Nama pengguna", "Username")}</label>
          <input id="unified-username" className="app-login-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          <label className="app-login-label" htmlFor="unified-password">{c("Kata sandi", "Password")}</label>
          <div className="app-login-password-wrap">
            <input id="unified-password" className="app-login-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? c("Sembunyikan kata sandi", "Hide password") : c("Tampilkan kata sandi", "Show password")}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} /></button>
          </div>
          {(formError || adminError || userError) && (
            <div className="app-login-error" role="alert" aria-live="polite">
              {formError || adminError || userError}
            </div>
          )}
          <button className="app-login-submit" type="submit" disabled={isLoading}>{isLoading ? c("Memproses...", "Signing in...") : c("Masuk", "Sign in")}</button>
          <div className="app-login-form-links">
            <button className="app-login-text-button" type="button" onClick={() => setForgotMode(true)}>{c("Lupa kata sandi?", "Forgot password?")}</button>
            {/* <Link className="app-login-text-button" to="/register">Daftar</Link> */}
          </div>
        </form>
      )}
    </div>
  );
}

export default function AppLoginPage() {
  const c = useBilingualCopy();
  const navigate = useNavigate();
  const userAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const adminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userLoading = useUserAuthStore((state) => state.isLoading);
  const adminLoading = useAuthStore((state) => state.isLoading);
  // Start every authenticated session in the main analysis workspace.
  const destination = "/carbon-estimation";

  useEffect(() => {
    if (userAuthenticated || adminAuthenticated) navigate(destination, { replace: true });
  }, [adminAuthenticated, destination, navigate, userAuthenticated]);

  if (userLoading || adminLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">{c("Memverifikasi sesi...", "Verifying session...")}</div>;
  }

  return (
    <div className="app-login-page">
      <div className="app-login-visual">
        <Link to="/" className="app-login-brand"><img src="/images/savegeo-logo.svg" alt="SaveGeo" /><span><strong>SaveGeo</strong><small>{c("Analitik Citra Satelit Berbasis AI", "AI-Powered Satellite Imagery Analytics")}</small></span></Link>
        <div className="app-login-visual-copy">
          <span className="landing-kicker"><span /> {c("RUANG KERJA AMAN", "SECURE WORKSPACE")}</span>
          <h1>{c("Data bumi untuk", "Earth data for")}<br /><em>{c("keputusan nyata.", "real decisions.")}</em></h1>
          <p>{c("Masuk ke ruang kerja SaveGeo untuk menggunakan analitik geospasial yang saling terhubung.", "Sign in to explore connected geospatial analytics in SaveGeo.")}</p>
        </div>
        <LoginIllustration ariaLabel={c("Ilustrasi bumi untuk keamanan platform SaveGeo", "Earth illustration for SaveGeo platform security")} cards={[{ kicker: "AOI", note: c("terpilih", "selected") }, { kicker: c("Layer", "Layer"), note: c("terhubung", "connected") }, { kicker: c("Wawasan", "Insight"), note: c("siap dibaca", "ready to explore") }]} />
      </div>
      <div className="app-login-panel">
        <UnifiedAccessForm />
      </div>
    </div>
  );
}
