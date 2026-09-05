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
          </div>
        )}
      </div>
      <div className="header-text">
        <h1>Big Matt&apos;s Value Buys</h1>
        <p className="tagline">Best price across Jewel, Aldi &amp; Target</p>
      </div>
    </header>
  );
}
