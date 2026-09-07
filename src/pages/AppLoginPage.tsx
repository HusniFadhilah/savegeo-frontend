import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginIllustration from "@/components/auth/LoginIllustration";
import LoginUserPage from "@/pages/LoginUserPage";
import RegisterUserPage from "@/pages/RegisterUserPage";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/apiClient";

type Mode = "user" | "admin";

function AdminAccessForm({ onBack }: { onBack: () => void }) {
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await login(username.trim(), password);
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setForgotError(null);
    if (!identifier.trim()) {
      setForgotError("Masukkan email atau username admin.");
      return;
    }
    setForgotLoading(true);
    try {
      const result = await authService.forgotPassword(identifier.trim());
      setMessage(result.message);
    } catch (err) {
      setForgotError(err instanceof ApiError ? err.message : "Gagal mengirim email reset password.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="app-login-form-card">
      <div className="app-login-form-heading"><span className="app-login-form-icon"><i className="bi bi-shield-lock" /></span><div><h2>Login Admin</h2><p>Akses workspace analitik dengan akun admin.</p></div></div>
      {forgotMode ? (
        <form onSubmit={submitForgot}>
          <label className="app-login-label" htmlFor="admin-reset-identifier">Email atau username</label>
          <input id="admin-reset-identifier" className="app-login-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          {forgotError && <div className="app-login-error">{forgotError}</div>}
          {message && <div className="app-login-success">{message}</div>}
          <button className="app-login-submit" type="submit" disabled={forgotLoading}>{forgotLoading ? "Mengirim..." : "Kirim Link Reset"}</button>
          <button className="app-login-text-button" type="button" onClick={() => setForgotMode(false)}>Kembali ke login</button>
        </form>
      ) : (
        <form onSubmit={submit}>
          <label className="app-login-label" htmlFor="admin-username">Username</label>
          <input id="admin-username" className="app-login-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          <label className="app-login-label" htmlFor="admin-password">Password</label>
          <div className="app-login-password-wrap"><input id="admin-password" className="app-login-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} /></button></div>
          {error && <div className="app-login-error">{error}</div>}
          <button className="app-login-submit" type="submit" disabled={isLoading}>{isLoading ? "Memproses..." : "Masuk sebagai Admin"}</button>
          <div className="app-login-form-links"><button className="app-login-text-button" type="button" onClick={() => setForgotMode(true)}>Lupa password?</button><button className="app-login-text-button" type="button" onClick={onBack}>Login sebagai user</button></div>
        </form>
      )}
    </div>
  );
}

export default function AppLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("user");
  const [view, setView] = useState<"login" | "register">("login");
  const userAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const adminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from !== "/login" ? from : "/carbon-estimation";

  useEffect(() => {
    if (userAuthenticated || adminAuthenticated) navigate(destination, { replace: true });
  }, [adminAuthenticated, destination, navigate, userAuthenticated]);

  if (mode === "admin") {
    return <div className="app-login-page"><div className="app-login-visual"><Link to="/" className="app-login-brand"><img src="/images/savegeo-logo.svg" alt="SaveGeo" /><span><strong>SaveGeo</strong><small>AI Imagery Analytics Platform</small></span></Link><div className="app-login-visual-copy"><span className="landing-kicker"><span /> SECURE WORKSPACE</span><h1>Data bumi untuk<br /><em>keputusan nyata.</em></h1><p>Masuk ke ruang kerja SaveGeo untuk mengeksplorasi analitik geospasial yang terhubung.</p></div><LoginIllustration ariaLabel="Visual bumi untuk keamanan platform SaveGeo" cards={[{ kicker: "AOI", note: "terpilih" }, { kicker: "Layer", note: "terhubung" }, { kicker: "Insight", note: "siap dibaca" }]} /></div><div className="app-login-panel"><AdminAccessForm onBack={() => setMode("user")} /></div></div>;
  }

  if (view === "register") return <RegisterUserPage onSwitchToLogin={() => setView("login")} />;
  return <div className="app-login-shell"><div className="app-login-backdrop" /><div className="app-login-simple-head"><Link to="/" className="app-login-brand"><img src="/images/savegeo-logo.svg" alt="SaveGeo" /><span><strong>SaveGeo</strong><small>AI Imagery Analytics Platform</small></span></Link><button type="button" className="app-login-admin-link" onClick={() => setMode("admin")}><i className="bi bi-shield-lock" /> Masuk sebagai Admin</button></div><div className="app-login-user-card"><div className="app-login-context"><span className="landing-kicker green"><span /> SAVEGEO PLATFORM</span><h1>Selamat datang<br /><em>di ruang kerja Anda.</em></h1><p>Gunakan akun user untuk mengakses seluruh fitur analitik SaveGeo.</p></div><div className="app-login-user-form"><LoginUserPage onSwitchToRegister={() => setView("register")} /></div></div></div>;
}
