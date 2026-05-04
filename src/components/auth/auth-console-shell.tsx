import Link from "next/link";

type AuthConsoleShellProps = {
  badge: string;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
  alternatePrompt: string;
  children: React.ReactNode;
};

// v2.0 auth shell — split layout (left manifesto, right form) matching the
// design bundle's auth/login.html. The right column wraps the children
// (Clerk SignIn/SignUp), preserving full auth functionality.
export function AuthConsoleShell({
  badge,
  title,
  description,
  alternateHref,
  alternateLabel,
  alternatePrompt,
  children,
}: AuthConsoleShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--fg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        .auth-wrap {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
          width: 100%;
        }
        .auth-left {
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(39,39,42,0.6);
          position: relative;
          overflow: hidden;
        }
        .auth-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(251,146,60,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251,146,60,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .auth-right {
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .auth-form-v2 {
          width: 100%;
          max-width: 420px;
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .auth-logo .logo-word-v2 {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #f4f4f5;
          letter-spacing: -0.02em;
        }
        .auth-logo .logo-word-v2 span {
          color: var(--accent);
        }
        @media (max-width: 768px) {
          .auth-wrap { grid-template-columns: 1fr; }
          .auth-left { display: none; }
        }
      `}</style>

      <div className="auth-wrap">
        {/* Left manifesto panel */}
        <div className="auth-left">
          <div style={{ position: "relative", zIndex: 1 }}>
            <Link href="/" className="auth-logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
                  stroke="#fb923c"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M10 8 h7 a5 5 0 0 1 0 10 h-7 M10 8 v16"
                  stroke="#fb923c"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="square"
                />
                <rect x="15" y="4" width="2" height="2.5" fill="#fb923c" />
                <rect x="15" y="25.5" width="2" height="2.5" fill="#fb923c" />
              </svg>
              <span className="logo-word-v2">
                praxis<span>.</span>
              </span>
            </Link>
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              className="praxis-label"
              style={{ color: "var(--accent)", marginBottom: 16 }}
            >
              ▸ {badge || "Operador · Gold III"}
            </div>
            <blockquote
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                margin: 0,
                color: "#f4f4f5",
              }}
            >
              {description ? (
                description
              ) : (
                <>
                  &ldquo;Disciplina não é humor.
                  <br />É sistema.&rdquo;
                </>
              )}
            </blockquote>
            <div
              className="praxis-label"
              style={{ marginTop: 24, color: "#52525b" }}
            >
              // MANIFESTO.TXT · SEÇÃO 02
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="praxis-label" style={{ color: "#52525b" }}>
              PRAXIS/AUTH/V2
            </span>
            <span
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div className="status-dot" />
              <span className="praxis-label" style={{ color: "#52525b" }}>
                SYS ONLINE
              </span>
            </span>
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-right">
          <div className="auth-form-v2">
            {/* Mobile logo */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 32,
              }}
              className="lg:hidden"
            >
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
                  stroke="#fb923c"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M10 8 h7 a5 5 0 0 1 0 10 h-7 M10 8 v16"
                  stroke="#fb923c"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="square"
                />
              </svg>
            </div>

            <div
              className="praxis-label"
              style={{ color: "var(--accent)", marginBottom: 12 }}
            >
              ACESSO · OPERADOR
            </div>
            <h1
              className="praxis-title"
              style={{ fontSize: 32, marginBottom: 24 }}
            >
              {title || "Entrar no protocolo"}
            </h1>

            {description ? (
              <p
                className="lg:hidden"
                style={{
                  fontSize: 13,
                  color: "var(--fg-3)",
                  marginBottom: 16,
                  lineHeight: 1.6,
                }}
              >
                {description}
              </p>
            ) : null}

            <div style={{ marginTop: 24 }}>{children}</div>

            <div
              style={{
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid rgba(39,39,42,0.6)",
                textAlign: "center",
              }}
            >
              <p
                style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 12 }}
              >
                {alternatePrompt}
              </p>
              <Link
                href={alternateHref}
                className="v2-btn"
                style={{ paddingLeft: 20, paddingRight: 20 }}
              >
                {alternateLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
