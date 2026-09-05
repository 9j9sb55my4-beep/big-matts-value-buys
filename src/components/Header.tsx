interface HeaderProps {
  logoSrc?: string | null;
}

export function Header({ logoSrc = '/big-matt-logo.png' }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="logo-slot" aria-label="Big Matt's Value Buys logo">
        {logoSrc ? (
          <img src={logoSrc} alt="Big Matt" className="logo-img" />
        ) : (
          <div className="logo-placeholder" role="img" aria-label="Big Matt mascot placeholder">
            <span className="logo-emoji" aria-hidden>
              🛒
            </span>
            <span className="logo-matt" aria-hidden>
              👍
            </span>
          </div>
        )}
      </div>
      <div className="header-text">
        <p className="eyebrow">Chicagoland grocery deals</p>
        <h1>Big Matt&apos;s Value Buys</h1>
        <p className="tagline">
          We scour Jewel, Aldi &amp; Target so you don&apos;t. Enter your ZIP —
          skip the flyer hunt and see the <strong>true deals</strong> this week.
        </p>
      </div>
    </header>
  );
}
