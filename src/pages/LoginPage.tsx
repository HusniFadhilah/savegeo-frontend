import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";

function LoginIllustration() {
  return (
    <div className="login-visual-stage" role="img" aria-label="Visual bumi realistis untuk pemantauan karbon satelit">
      <span className="login-orbit login-orbit-a" aria-hidden="true" />
      <span className="login-orbit login-orbit-b" aria-hidden="true" />
      <span className="login-earth-shell" aria-hidden="true">
        <img className="login-earth" src="/images/login-earth-globe-indonesia.png" alt="" />
      </span>
      <div className="login-scan-line login-scan-line-a" aria-hidden="true" />
      <div className="login-scan-line login-scan-line-b" aria-hidden="true" />
      <div className="login-floating-card login-floating-card-a">
        <span className="login-card-kicker">NDVI</span>
        <svg className="login-mini-chart" viewBox="0 0 92 34" aria-hidden="true">
          <path className="login-chart-grid" d="M4 27 H88 M4 17 H88 M4 7 H88" />
          <path className="login-chart-line" d="M5 25 C17 20 22 22 31 15 C41 7 50 13 58 10 C70 5 77 8 87 4" />
        </svg>
        <span className="login-card-note">vegetasi stabil</span>
      </div>
      <div className="login-floating-card login-floating-card-b">
        <span className="login-card-kicker">Carbon</span>
        <div className="login-bar-chart" aria-hidden="true">
          <span style={{ "--bar-h": "46%" } as CSSProperties} />
          <span style={{ "--bar-h": "62%" } as CSSProperties} />
          <span style={{ "--bar-h": "78%" } as CSSProperties} />
          <span style={{ "--bar-h": "56%" } as CSSProperties} />
        </div>
        <span className="login-card-note">tren naik</span>
      </div>
      <div className="login-floating-card login-floating-card-c">
        <span className="login-card-kicker">AOI</span>
        <div className="login-aoi-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="login-card-note">area aktif</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration />
          <h2>SAVEGEO</h2>
          <p>Pemantauan stok karbon berbasis citra satelit &amp; machine learning.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">SAVEGEO Admin</h5>
            <small className="text-muted">Masuk untuk mengelola sistem</small>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small">Username</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label small">Password</label>
              <div className="position-relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control pe-5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn bg-white border-0 p-0 position-absolute top-50 end-0 translate-middle-y me-3 text-secondary"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </div>
            {error && <div className="alert alert-danger py-2 px-2 small">{error}</div>}
            <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
