import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { DataBanner } from './components/DataBanner';
import { ZipBar } from './components/ZipBar';
import { StoreToggles } from './components/StoreToggles';
import { CategoryGrid } from './components/CategoryGrid';
import { DealList } from './components/DealList';
import { HowItWorks } from './components/HowItWorks';
import { CATEGORIES } from './data/categories';
import { DEFAULT_ZIP, STORES } from './data/stores';
import { loadWeeklyDeals } from './lib/loadDeals';
import { addCrossStoreHints, rankDeals } from './lib/ranking';
import type {
  CategoryId,
  DataSource,
  PriceHistoryStore,
  ScoredDeal,
  StoreId,
  WeekPayload,
} from './types';
import './App.css';

const ALL_CATS = new Set(CATEGORIES.map((c) => c.id));
const ALL_STORES = new Set(STORES.map((s) => s.id));

export default function App() {
  const [zip, setZip] = useState(DEFAULT_ZIP);
  const [categories, setCategories] = useState<Set<CategoryId>>(new Set(ALL_CATS));
  const [stores, setStores] = useState<Set<StoreId>>(new Set(ALL_STORES));
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [preferLive, setPreferLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const [history, setHistory] = useState<PriceHistoryStore | null>(null);
  const [source, setSource] = useState<DataSource>('demo');
  const [banner, setBanner] = useState('Loading…');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadWeeklyDeals(zip, preferLive);
      setWeek(result.week);
      setHistory(result.history);
      setSource(result.source);
      setBanner(result.banner);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading deals.');
    } finally {
      setLoading(false);
    }
  }, [zip, preferLive]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scored: ScoredDeal[] = useMemo(() => {
    if (!week) return [];
    const filtered = week.deals.filter(
      (d) => stores.has(d.store) && categories.has(d.category),
    );
    return addCrossStoreHints(rankDeals(filtered, history));
  }, [week, history, stores, categories]);

  const steals = scored.filter((d) => d.tier === 'steal').length;

  function toggleCat(id: CategoryId) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStore(id: StoreId) {
    setStores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return prev;
      return next;
    });
  }

  return (
    <div className="app">
      <Header logoSrc="/big-matt-logo.png" />

      <DataBanner source={source} message={banner} />

      <main className="main">
        <ZipBar zip={zip} onZipChange={setZip} />

        <CategoryGrid
          selected={categories}
          onToggle={toggleCat}
          onSelectAll={() => setCategories(new Set(ALL_CATS))}
        />

        <StoreToggles selected={stores} onToggle={toggleStore} />

        <section className="toolbar panel">
          <div className="toolbar-text">
            <h2 className="results-title">Best true deals this week</h2>
            <p className="muted">
              {loading
                ? 'Checking the ads…'
                : `${scored.length} deals · ${steals} marked “Best deal” · ${week?.weekLabel ?? ''}`}
            </p>
          </div>
          <div className="toolbar-actions">
            <label className="check-label">
              <input
                type="checkbox"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
              />
              Group by category
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={preferLive}
                onChange={(e) => setPreferLive(e.target.checked)}
              />
              Try live ads first
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh weekly ads'}
            </button>
          </div>
        </section>

        <HowItWorks />

        {error ? <div className="error-box">{error}</div> : null}

        {loading && !week ? (
          <p className="loading">Loading Big Matt&apos;s picks…</p>
        ) : (
          <DealList deals={scored} groupByCategory={groupByCategory} />
        )}
      </main>

      <footer className="site-footer">
        <p>
          Big Matt&apos;s Value Buys · ZIP {zip} · Jewel · Aldi · Target
        </p>
        <p className="muted">
          Live mode uses Flipp search for your ZIP. Demo is only a labeled fallback if live fails.
        </p>
      </footer>
    </div>
  );
}
