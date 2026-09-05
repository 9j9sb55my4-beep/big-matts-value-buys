import type { DataSource } from '../types';

interface Props {
  source: DataSource;
  message: string;
}

export function DataBanner({ source, message }: Props) {
  const label = source === 'demo' ? 'Demo' : 'Live';
  return (
    <div
      className={`data-banner ${source === 'demo' ? 'demo' : 'live'}`}
      role="status"
    >
      <span className="banner-dot" aria-hidden />
      <span className="banner-line">
        <strong>{label}</strong>
        {message ? ` · ${message}` : ''}
      </span>
    </div>
  );
}
