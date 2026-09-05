import { useEffect, useState } from 'react';
import {
  DEFAULT_ZIP,
  isValidUsZip,
  locationLabelForZip,
} from '../data/stores';

interface Props {
  zip: string;
  onZipChange: (zip: string) => void;
}

const SUGGESTIONS = ['60610', '60611', '60614', '60647', '60657', '60540'];

export function ZipBar({ zip, onZipChange }: Props) {
  const [draft, setDraft] = useState(zip);

  useEffect(() => {
    setDraft(zip);
  }, [zip]);

  function apply(next: string) {
    const cleaned = next.replace(/\D/g, '').slice(0, 5);
    setDraft(cleaned);
    if (isValidUsZip(cleaned)) onZipChange(cleaned);
  }

  const valid = isValidUsZip(draft);

  return (
    <section className="panel zip-bar" aria-label="Location">
      <label htmlFor="zip-input" className="panel-label">
        Your ZIP
      </label>
      <div className="zip-row">
        <input
          id="zip-input"
          className="big-select zip-input"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          value={draft}
          placeholder={DEFAULT_ZIP}
          aria-describedby="zip-hint"
          onChange={(e) => apply(e.target.value)}
          onBlur={() => {
            if (!isValidUsZip(draft) && zip) setDraft(zip);
          }}
        />
        <p id="zip-hint" className="zip-hint">
          {valid ? locationLabelForZip(draft) : '5-digit US ZIP'}
        </p>
      </div>
      <div className="chip-row zip-suggestions" aria-label="Suggested ZIPs">
        {SUGGESTIONS.map((z) => (
          <button
            key={z}
            type="button"
            className={`chip zip-chip ${zip === z ? 'on' : ''}`}
            onClick={() => apply(z)}
          >
            {z}
          </button>
        ))}
      </div>
    </section>
  );
}
