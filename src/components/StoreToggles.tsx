import { STORES } from '../data/stores';
import type { StoreId } from '../types';

interface Props {
  selected: Set<StoreId>;
  onToggle: (id: StoreId) => void;
}

export function StoreToggles({ selected, onToggle }: Props) {
  return (
    <section className="panel" aria-label="Stores">
      <p className="panel-label">Stores to include</p>
      <div className="chip-row">
        {STORES.map((s) => {
          const on = selected.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`chip store-chip ${on ? 'on' : ''}`}
              style={{ ['--store' as string]: s.color }}
              aria-pressed={on}
              onClick={() => onToggle(s.id)}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
