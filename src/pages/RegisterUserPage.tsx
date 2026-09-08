import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import LoginIllustration from "@/components/auth/LoginIllustration";

/**
 * Registration page for the public SaveGeo users table. This page has its own
 * URL so the login and registration flows remain shareable and bookmarkable.
 */
export default function RegisterUserPage() {
  const { register, isLoading, error } = useUserAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 8) {
      setLocalError("Password minimal 8 karakter.");
      return;
    }
    if (await register(username, email, password)) navigate("/dashboard", { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel="Visual bumi realistis untuk analitik geospasial SaveGeo"
            cards={[
              { kicker: "Vegetasi", note: "area terpantau" },
              { kicker: "Karbon", note: "stok terukur" },
              { kicker: "Tutupan lahan", note: "perubahan terdeteksi" },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>Platform analitik geospasial untuk memahami wilayah, memantau perubahan, dan mendukung keputusan berbasis data.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">Daftar Akun SaveGeo</h5>
            <small className="text-muted">Buat akun untuk mengakses seluruh fitur analitik SaveGeo</small>
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
              <label className="form-label small">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                  autoComplete="new-password"
                  minLength={8}
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
              <small className="text-muted">Minimal 8 karakter.</small>
            </div>
            {(localError || error) && <div className="alert alert-danger py-2 px-2 small">{localError || error}</div>}
            <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Daftar"}
            </button>
            <div className="text-center mt-3 small">
              Sudah punya akun?{" "}
              <Link to="/login" className="btn btn-link p-0 align-baseline">
                Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
