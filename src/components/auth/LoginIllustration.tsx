import type { CSSProperties } from "react";

export interface LoginIllustrationCard {
  kicker: string;
  note: string;
}

interface Props {
  ariaLabel: string;
  cards: [LoginIllustrationCard, LoginIllustrationCard, LoginIllustrationCard];
}

/**
 * Shared Indonesia-globe illustration for every login screen (admin
 * `pages/LoginPage.tsx` and the public `/pemetaan-bencana` gate's
 * `pages/LoginUserPage.tsx`). Orbit rings, scan lines, and the 3 floating
 * stat-card shapes are identical markup/CSS (see app.css's `.login-*`
 * rules) - only the 3 cards' kicker/note text is parameterized per
 * audience, so each login reads as its own product surface (carbon vs.
 * disaster) instead of a copy-pasted screen with the wrong labels.
 */
export default function LoginIllustration({ ariaLabel, cards }: Props) {
  const [cardA, cardB, cardC] = cards;
  return (
    <div className="login-visual-stage" role="img" aria-label={ariaLabel}>
      <span className="login-orbit login-orbit-a" aria-hidden="true" />
      <span className="login-orbit login-orbit-b" aria-hidden="true" />
      <span className="login-earth-shell" aria-hidden="true">
        <img className="login-earth" src="/images/login-earth-globe-indonesia.png" alt="" />
      </span>
      <div className="login-scan-line login-scan-line-a" aria-hidden="true" />
      <div className="login-scan-line login-scan-line-b" aria-hidden="true" />
      <div className="login-floating-card login-floating-card-a">
        <span className="login-card-kicker">{cardA.kicker}</span>
        <svg className="login-mini-chart" viewBox="0 0 92 34" aria-hidden="true">
          <path className="login-chart-grid" d="M4 27 H88 M4 17 H88 M4 7 H88" />
          <path className="login-chart-line" d="M5 25 C17 20 22 22 31 15 C41 7 50 13 58 10 C70 5 77 8 87 4" />
        </svg>
        <span className="login-card-note">{cardA.note}</span>
      </div>
      <div className="login-floating-card login-floating-card-b">
        <span className="login-card-kicker">{cardB.kicker}</span>
        <div className="login-bar-chart" aria-hidden="true">
          <span style={{ "--bar-h": "46%" } as CSSProperties} />
          <span style={{ "--bar-h": "62%" } as CSSProperties} />
          <span style={{ "--bar-h": "78%" } as CSSProperties} />
          <span style={{ "--bar-h": "56%" } as CSSProperties} />
        </div>
        <span className="login-card-note">{cardB.note}</span>
      </div>
      <div className="login-floating-card login-floating-card-c">
        <span className="login-card-kicker">{cardC.kicker}</span>
        <div className="login-aoi-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="login-card-note">{cardC.note}</span>
      </div>
    </div>
  );
}
