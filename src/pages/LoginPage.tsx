import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";

/** One 240x240 tile of ocean + islands, repeated twice side by side so the
 * rotating group can loop seamlessly (translateX 0 -> -240 -> reset). */
function GlobeTile({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0" y="0" width="240" height="240" fill="url(#li-ocean)" />
      {/* islands - loose, irregular blobs, not literal geography */}
      <path d="M28 60 Q48 42 74 54 Q92 64 82 84 Q64 96 42 88 Q22 80 28 60 Z" fill="#43a047" />
      <path d="M120 40 Q146 30 158 50 Q164 68 144 74 Q124 76 116 60 Q112 48 120 40 Z" fill="#2e7d32" />
      <ellipse cx="190" cy="90" rx="20" ry="13" fill="#66bb6a" />
      <path d="M50 140 Q80 126 108 142 Q124 156 104 174 Q78 188 54 174 Q36 160 50 140 Z" fill="#2e7d32" />
      <path d="M150 150 Q176 142 192 158 Q200 174 180 184 Q158 190 148 172 Q142 160 150 150 Z" fill="#43a047" />
      <ellipse cx="30" cy="200" rx="16" ry="10" fill="#66bb6a" />
      <ellipse cx="215" cy="205" rx="14" ry="9" fill="#2e7d32" />
      <ellipse cx="100" cy="205" rx="10" ry="7" fill="#66bb6a" />
    </g>
  );
}

function LoginIllustration() {
  return (
    <svg viewBox="0 0 420 420" className="login-illust-svg" role="img" aria-label="Ilustrasi bumi berputar - pemantauan karbon satelit">
      <defs>
        <radialGradient id="li-ocean" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4fc3f7" />
          <stop offset="55%" stopColor="#0288d1" />
          <stop offset="100%" stopColor="#01579b" />
        </radialGradient>
        <linearGradient id="li-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef6ef" />
        </linearGradient>
        <radialGradient id="li-sheen" cx="32%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="li-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0d3b16" floodOpacity="0.25" />
        </filter>
        <clipPath id="li-globe-clip">
          <circle cx="210" cy="190" r="120" />
        </clipPath>
      </defs>

      <ellipse cx="210" cy="360" rx="140" ry="18" fill="#0d3b16" opacity="0.12" />

      <g filter="url(#li-shadow)">
        <g clipPath="url(#li-globe-clip)">
          <g className="li-globe-rotate" transform="translate(90,70)">
            <GlobeTile x={0} />
            <GlobeTile x={240} />
          </g>
          <circle cx="210" cy="190" r="120" fill="url(#li-sheen)" />
        </g>
        <circle cx="210" cy="190" r="120" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
      </g>

      <g transform="translate(60,90)" filter="url(#li-shadow)">
        <rect x="0" y="0" width="72" height="50" rx="8" fill="url(#li-panel)" />
        <rect x="8" y="10" width="30" height="6" rx="3" fill="#2e7d32" />
        <rect x="8" y="22" width="46" height="5" rx="2.5" fill="#c8e6c9" />
        <rect x="8" y="31" width="38" height="5" rx="2.5" fill="#c8e6c9" />
        <rect x="8" y="40" width="24" height="5" rx="2.5" fill="#c8e6c9" />
      </g>

      <g transform="translate(272,70)" filter="url(#li-shadow)">
        <rect x="-26" y="-18" width="52" height="36" rx="8" fill="#ffffff" />
        <rect x="-18" y="-4" width="10" height="14" rx="2" fill="#a5d6a7" />
        <rect x="-4" y="-10" width="10" height="20" rx="2" fill="#4caf50" />
        <rect x="10" y="-14" width="10" height="24" rx="2" fill="#2e7d32" />
      </g>

      <g transform="translate(150,260)" filter="url(#li-shadow)">
        <circle r="34" fill="#2e7d32" />
        <path
          d="M-14 8 C-14 -12 8 -18 16 -14 C16 6 -2 16 -14 8 Z"
          fill="#ffffff"
          opacity="0.9"
        />
        <path d="M-13 7 L14 -13" stroke="#2e7d32" strokeWidth="2" fill="none" />
      </g>

      <g transform="translate(300,270)" filter="url(#li-shadow)">
        <rect x="-30" y="-20" width="60" height="40" rx="9" fill="#ffffff" />
        <circle cx="-14" cy="0" r="10" fill="none" stroke="#2e7d32" strokeWidth="4" strokeDasharray="44" strokeDashoffset="12" />
        <text x="10" y="-2" fontSize="9" fill="#1b5e20" fontWeight="700">R²</text>
        <text x="10" y="10" fontSize="9" fill="#4b5563">0.87</text>
      </g>

      <g stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeDasharray="4 6">
        <path d="M118 118 L150 260" />
        <path d="M272 88 L232 250" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
            <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
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
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
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
