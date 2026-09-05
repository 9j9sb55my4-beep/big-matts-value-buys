import type { DataSource } from '../types';

interface Props {
  source: DataSource;
  message: string;
}

export function DataBanner({ source, message }: Props) {
  return (
    <div
      className={`data-banner ${source === 'demo' ? 'demo' : 'live'}`}
      role="status"
    >
      <strong>{source === 'demo' ? 'Demo mode' : 'Live ads'}</strong>
      <span>{message}</span>
    </div>
  );
}
