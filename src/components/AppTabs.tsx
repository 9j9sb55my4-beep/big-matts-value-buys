export type AppTab = 'deals' | 'grocery';

interface Props {
  tab: AppTab;
  onChange: (tab: AppTab) => void;
  groceryCount: number;
}

export function AppTabs({ tab, onChange, groceryCount }: Props) {
  return (
    <nav className="app-tabs" aria-label="Main">
      <button
        type="button"
        className={`app-tab ${tab === 'deals' ? 'on' : ''}`}
        aria-current={tab === 'deals' ? 'page' : undefined}
        onClick={() => onChange('deals')}
      >
        Deals
      </button>
      <button
        type="button"
        className={`app-tab ${tab === 'grocery' ? 'on' : ''}`}
        aria-current={tab === 'grocery' ? 'page' : undefined}
        onClick={() => onChange('grocery')}
      >
        Grocery list
        {groceryCount > 0 ? (
          <span className="tab-badge" aria-label={`${groceryCount} items`}>
            {groceryCount > 99 ? '99+' : groceryCount}
          </span>
        ) : null}
      </button>
    </nav>
  );
}
