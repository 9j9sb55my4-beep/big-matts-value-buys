import { CATEGORIES, categoryMeta } from '../data/categories';
import { formatUnitPrice } from '../lib/sizeParse';
import type { GroceryItem } from '../lib/groceryList';
import type { CategoryId } from '../types';

interface Props {
  items: GroceryItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function GroceryListView({ items, onRemove, onClearAll }: Props) {
  if (items.length === 0) {
    return (
      <div className="grocery-empty panel">
        <p className="grocery-empty-title">Your list is empty</p>
        <p className="muted">Tap ✓ on deals to build your list</p>
      </div>
    );
  }

  const order = CATEGORIES.map((c) => c.id);
  const groups = new Map<CategoryId, GroceryItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  function handleClear() {
    if (window.confirm('Clear your whole grocery list?')) {
      onClearAll();
    }
  }

  return (
    <div className="grocery-view">
      <div className="grocery-toolbar panel">
        <div>
          <h2 className="results-title">Grocery list</h2>
          <p className="muted">
            {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" className="btn-danger" onClick={handleClear}>
          Clear all
        </button>
      </div>

      <div className="grocery-groups">
        {order.map((id) => {
          const list = groups.get(id);
          if (!list?.length) return null;
          const meta = CATEGORIES.find((c) => c.id === id)!;
          return (
            <section key={id} className="grocery-group">
              <h3 className="grocery-group-title">
                <span aria-hidden>{meta.emoji}</span> {meta.label}
              </h3>
              <ul className="grocery-list">
                {list.map((item) => {
                  const unitLabel =
                    item.unitPrice != null && item.unit
                      ? formatUnitPrice(item.unitPrice, item.unit)
                      : undefined;
                  const cat = categoryMeta(item.category);
                  return (
                    <li key={item.id} className="grocery-item">
                      <button
                        type="button"
                        className="list-check on"
                        aria-label={`Remove ${item.name} from list`}
                        onClick={() => onRemove(item.id)}
                      >
                        <span aria-hidden>✓</span>
                      </button>
                      <div className="grocery-item-body">
                        <div className="grocery-item-top">
                          <span className="store-pill" data-store={item.store}>
                            {item.storeLabel}
                          </span>
                          <span className="grocery-price">{money(item.price)}</span>
                        </div>
                        <p className="grocery-name">
                          {item.brand ? (
                            <span className="brand">{item.brand} · </span>
                          ) : null}
                          {item.name}
                        </p>
                        {cat ? (
                          <p className="deal-category grocery-category">
                            <span className="deal-category-emoji" aria-hidden>
                              {cat.emoji}
                            </span>
                            <span>{cat.shortLabel}</span>
                          </p>
                        ) : null}
                        {item.size ? (
                          <p className="grocery-size">
                            {item.size}
                            {unitLabel ? ` · ${unitLabel}` : ''}
                          </p>
                        ) : unitLabel ? (
                          <p className="grocery-size">{unitLabel}</p>
                        ) : (
                          <p className="grocery-size missing">Size not listed</p>
                        )}
                        {item.crossNote ? (
                          <p className="grocery-note">{item.crossNote}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
