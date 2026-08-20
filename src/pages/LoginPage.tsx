import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import LoginIllustration from "@/components/auth/LoginIllustration";

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
          <LoginIllustration
            ariaLabel="Visual bumi realistis untuk pemantauan karbon satelit"
            cards={[
              { kicker: "NDVI", note: "vegetasi stabil" },
              { kicker: "Carbon", note: "tren naik" },
              { kicker: "AOI", note: "area aktif" },
            ]}
          />
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
