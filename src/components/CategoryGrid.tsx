import { CATEGORIES } from '../data/categories';
import type { CategoryId } from '../types';

interface Props {
  selected: Set<CategoryId>;
  onToggle: (id: CategoryId) => void;
  onSelectAll: () => void;
}

export function CategoryGrid({ selected, onToggle, onSelectAll }: Props) {
  return (
    <section className="panel" aria-label="Categories">
      <div className="panel-head">
        <p className="panel-label">What do you need?</p>
        <button type="button" className="linkish" onClick={onSelectAll}>
          Select all
        </button>
      </div>
      <div className="category-grid">
        {CATEGORIES.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`cat-btn ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
            >
              <span className="cat-emoji" aria-hidden>
                {c.emoji}
              </span>
              <span className="cat-label">{c.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
