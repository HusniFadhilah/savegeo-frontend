import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginIllustration from "@/components/auth/LoginIllustration";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { authService } from "@/services/authService";
import { userAuthService } from "@/services/userAuthService";
import { ApiError } from "@/services/apiClient";

function UnifiedAccessForm() {
  const userLogin = useUserAuthStore((state) => state.login);
  const userLoading = useUserAuthStore((state) => state.isLoading);
  const userError = useUserAuthStore((state) => state.error);
  const adminLogin = useAuthStore((state) => state.login);
  const adminLoading = useAuthStore((state) => state.isLoading);
  const adminError = useAuthStore((state) => state.error);
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
    if (await userLogin(credentials.username, credentials.password)) return;
    setFormError(
        useUserAuthStore.getState().error ||
        useAuthStore.getState().error ||
        "Username atau password tidak sesuai.",
    );
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setResetMessage(null);
    setResetError(null);
    if (!identifier.trim()) {
      setResetError("Masukkan email atau username.");
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
        setResetError(error instanceof ApiError ? error.message : "Gagal mengirim email reset password.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="app-login-form-card">
      <div className="app-login-form-heading">
        <span className="app-login-form-icon"><i className="bi bi-shield-lock" /></span>
        <div><h2>Login SaveGeo</h2><p>Akses workspace analitik dengan akun user atau admin.</p></div>
      </div>
      <div className="app-login-role-note"><i className="bi bi-shield-check" /> Akses dan authorization akan menyesuaikan role akun Anda.</div>
      {forgotMode ? (
        <form onSubmit={submitForgot}>
          <label className="app-login-label" htmlFor="unified-reset-identifier">Email atau username</label>
          <input id="unified-reset-identifier" className="app-login-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
          {resetError && <div className="app-login-error">{resetError}</div>}
          {resetMessage && <div className="app-login-success">{resetMessage}</div>}
          <button className="app-login-submit" type="submit" disabled={resetLoading}>{resetLoading ? "Mengirim..." : "Kirim Link Reset"}</button>
          <button className="app-login-text-button" type="button" onClick={() => setForgotMode(false)}>Kembali ke login</button>
        </form>
      ) : (
        <form onSubmit={submit}>
          <label className="app-login-label" htmlFor="unified-username">Username</label>
          <input id="unified-username" className="app-login-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          <label className="app-login-label" htmlFor="unified-password">Password</label>
          <div className="app-login-password-wrap">
            <input id="unified-password" className="app-login-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} /></button>
          </div>
          {(formError || adminError || userError) && (
            <div className="app-login-error" role="alert" aria-live="polite">
              {formError || adminError || userError}
            </div>
          )}
          <button className="app-login-submit" type="submit" disabled={isLoading}>{isLoading ? "Memproses..." : "Login"}</button>
          <div className="app-login-form-links">
            <button className="app-login-text-button" type="button" onClick={() => setForgotMode(true)}>Lupa password?</button>
            {/* <Link className="app-login-text-button" to="/register">Daftar</Link> */}
          </div>
        </form>
      )}
    </div>
  );
}

export default function AppLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const userAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const adminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userLoading = useUserAuthStore((state) => state.isLoading);
  const adminLoading = useAuthStore((state) => state.isLoading);
  const from = (location.state as { from?: string } | null)?.from;
  const destination = adminAuthenticated
    ? "/admin"
    : from && from !== "/login"
      ? from
      : "/dashboard";

  useEffect(() => {
    if (userAuthenticated || adminAuthenticated) navigate(destination, { replace: true });
  }, [adminAuthenticated, destination, navigate, userAuthenticated]);

  if (userLoading || adminLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">Memverifikasi sesi...</div>;
  }

  return (
    <div className="app-login-page">
      <div className="app-login-visual">
        <Link to="/" className="app-login-brand"><img src="/images/savegeo-logo.svg" alt="SaveGeo" /><span><strong>SaveGeo</strong><small>AI Imagery Analytics Platform</small></span></Link>
        <div className="app-login-visual-copy">
          <span className="landing-kicker"><span /> SECURE WORKSPACE</span>
          <h1>Data bumi untuk<br /><em>keputusan nyata.</em></h1>
          <p>Masuk ke ruang kerja SaveGeo untuk mengeksplorasi analitik geospasial yang terhubung.</p>
        </div>
        <LoginIllustration ariaLabel="Visual bumi untuk keamanan platform SaveGeo" cards={[{ kicker: "AOI", note: "terpilih" }, { kicker: "Layer", note: "terhubung" }, { kicker: "Insight", note: "siap dibaca" }]} />
      </div>
      <div className="app-login-panel">
        <UnifiedAccessForm />
      </div>
    </div>
  );
}
