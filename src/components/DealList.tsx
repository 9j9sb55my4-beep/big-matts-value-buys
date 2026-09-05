import type { CategoryId, ScoredDeal } from '../types';
import { CATEGORIES } from '../data/categories';
import { DealCard } from './DealCard';

interface Props {
  deals: ScoredDeal[];
  groupByCategory: boolean;
  listIds: Set<string>;
  onToggleList: (deal: ScoredDeal) => void;
}

export function DealList({
  deals,
  groupByCategory,
  listIds,
  onToggleList,
}: Props) {
  if (deals.length === 0) {
    return (
      <div className="empty">
        <p>No deals for those filters.</p>
        <p className="muted">Try selecting more categories or stores.</p>
      </div>
    );
  }

  if (!groupByCategory) {
    return (
      <div className="deal-list">
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            inList={listIds.has(d.id)}
            onToggleList={onToggleList}
          />
        ))}
      </div>
    );
  }

  const order = CATEGORIES.map((c) => c.id);
  const groups = new Map<CategoryId, ScoredDeal[]>();
  for (const d of deals) {
    const list = groups.get(d.category) ?? [];
    list.push(d);
    groups.set(d.category, list);
  }

  return (
    <div className="deal-list grouped">
      {order.map((id) => {
        const list = groups.get(id);
        if (!list?.length) return null;
        const meta = CATEGORIES.find((c) => c.id === id)!;
        return (
          <section key={id} className="cat-group">
            <h2 className="cat-group-title"><span aria-hidden>{meta.emoji}</span> {meta.label}</h2>
            {list.map((d) => (
              <DealCard
                key={d.id}
                deal={d}
                inList={listIds.has(d.id)}
                onToggleList={onToggleList}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
