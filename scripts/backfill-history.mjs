/**
 * Day-one price history backfill for Big Matt's Value Buys.
 *
 * Flipp hosts current + some still-reachable older flyers — NOT a clean
 * multi-year archive. This script:
 *  1) Seeds plausible 10–12 week baselines for Chicagoland staples (source: seed)
 *  2) Pulls live search across several ZIPs (source: flipp-live)
 *  3) Fetches /flipp/flyers/{id} for flyer_ids seen in search + bounded nearby probes
 *     (source: flipp-archive)
 *  4) Writes merged public/price-history.json
 *
 * Usage: node scripts/backfill-history.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/price-history.json');
const BASE = 'https://backflipp.wishabi.com';

const ZIPS = ['60610', '60647', '60614', '60540', '60007', '60453'];
const SEARCH_QUERIES = [
  'jewel',
  'aldi',
  'target',
  'chicken',
  'beef',
  'pork',
  'eggs',
  'milk',
  'cheese',
  'avocado',
  'banana',
  'berries',
  'bread',
  'pasta',
  'pizza',
  'ice cream',
  'yogurt',
  'butter',
  'chips',
  'detergent',
  'paper towels',
  'wine',
  'beer',
  'ham',
  'salmon',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(organic|fresh|premium|select|selected|family pack|pk|pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrice(v) {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 500 ? n : undefined;
}

function matchStore(merchantName) {
  const lower = String(merchantName || '').toLowerCase();
  if (lower.includes('jewel')) return 'jewel-osco';
  if (lower.includes('aldi')) return 'aldi';
  if (lower.includes('target')) return 'target';
  return null;
}

function guessStoreFromItem(name, brand) {
  const blob = `${name || ''} ${brand || ''}`.toLowerCase();
  if (/clancy|never any|friendly farms|specially selected|l'?oven|priano|reggano|winking owl|appleton farms|casa mamita|kirkwood|little salad/.test(blob))
    return 'aldi';
  if (/good\s*&\s*gather|favorite day|market pantry|up & up|freshness guaranteed/.test(blob))
    return 'target';
  if (/lucerne|signature|open nature|oroweat|boar'?s head|just bare/.test(blob))
    return 'jewel-osco';
  return null;
}

function guessCategory(name) {
  const blob = String(name || '').toLowerCase();
  if (/beer|wine|vodka|liquor|prosecco|seltzer|alcohol/.test(blob) && !/wine\s+vinegar/.test(blob)) return 'alcohol';
  if (/shampoo|conditioner|deodorant|toothpaste|makeup|beauty|cosmetic/.test(blob)) return 'beauty';
  if (/detergent|soap|cleaner|paper towel|tissue|trash|laundry|dish/.test(blob)) return 'household';
  if (/canned|\bbeans?\b|chick\s*peas?|pasta|rice|cereal|soup|flour|peanut\s+butter|vegetable\s+oil/.test(blob) && !/green\s+beans?/.test(blob)) return 'pantry';
  if (/chip|cookie|cracker|snack|popcorn|pretzel|candy/.test(blob)) return 'snacks';
  if (/bread|bagel|bakery|croissant|muffin|roll|bun|tortilla/.test(blob)) return 'bakery';
  if (/deli|\bham\b|salami|bologna|sliced\s+turkey/.test(blob)) return 'deli';
  if (/frozen|ice cream|pizza|burrito|waffle/.test(blob)) return 'frozen';
  // Word-bound eggs — never match egg inside veggies
  if (/\bmilk\b|\beggs?\b|\bcheese\b|\byogurt\b|\bbutter\b|\bcream\b|\bdairy\b/.test(blob) && !/peanut\s+butter|ice\s*cream/.test(blob)) return 'dairy';
  if (/avocado|banana|berry|apple|lettuce|broccoli|pepper|tomato|grape|produce|onion|potato|green\s+beans?/.test(blob))
    return 'produce';
  if (/beef|chicken|pork|turkey|sausage|salmon|meat|steak|\bribs?\b|ground\s+(?:beef|turkey)|seafood|shrimp/.test(blob))
    return 'meat';
  return 'pantry';
}

function detectPromo(story, price, reg) {
  const s = String(story || '').toLowerCase();
  if (/bogo|buy\s*one\s*get\s*one|buy 1 get 1/.test(s)) return 'bogo';
  if (/\d+\s*(?:for|\/)\s*\$?\s*\d/.test(s)) return 'multi';
  if (reg != null && price != null && reg > price) return 'sale';
  if (s.trim()) return 'sale';
  return 'plain';
}

function weekStartFrom(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  // Normalize to Wednesday-ish grocery week: use the date's calendar day (UTC date part)
  return String(iso).slice(0, 10);
}

function mondayOf(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = d.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---------- Seed catalog (10–12 weeks) ----------
function buildSeedWeeks() {
  // End week = week of Sep 3 2026; go back 11 prior Wednesdays → 12 weeks
  const end = new Date('2026-09-03T12:00:00Z');
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

function wobble(base, i, amp = 0.08) {
  const wave = Math.sin(i * 1.7) * amp + Math.cos(i * 0.9) * (amp * 0.5);
  return Math.round((base * (1 + wave)) * 100) / 100;
}

/** Plausible multi-week baselines for common Chicagoland staples */
function buildSeedCatalog(weeks) {
  const n = weeks.length;
  const mk = (store, category, name, unit, typical, opts = {}) => {
    const history = [];
    const promos = [];
    for (let i = 0; i < n; i++) {
      const isSale = opts.saleWeeks?.includes(i) || (i % 4 === 2 && !opts.noAutoSale);
      const isBogo = opts.bogoWeeks?.includes(i);
      const isMulti = opts.multiWeeks?.includes(i);
      let price = wobble(typical, i, opts.amp ?? 0.07);
      if (isSale) price = Math.round(typical * (opts.saleFactor ?? 0.78) * 100) / 100;
      if (isBogo) price = Math.round(typical * (opts.bogoList ?? 0.55) * 100) / 100;
      if (isMulti) price = Math.round(typical * (opts.multiFactor ?? 0.7) * 100) / 100;
      // Last week often a "good deal" for demo/live alignment
      if (i === n - 1 && opts.currentDeal) {
        price = opts.currentDeal;
      }
      history.push(price);
      if (isBogo || (i === n - 1 && opts.currentPromo === 'bogo')) promos.push('bogo');
      else if (isMulti || (i === n - 1 && opts.currentPromo === 'multi')) promos.push('multi');
      else if (isSale || (i === n - 1 && opts.currentPromo === 'sale')) promos.push('sale');
      else promos.push('plain');
    }
    // Ensure BOGO is rare in baseline: clear prior bogo flags except intentional
    if (opts.rareBogoCurrent) {
      for (let i = 0; i < n - 1; i++) {
        if (promos[i] === 'bogo') {
          promos[i] = 'plain';
          history[i] = wobble(typical, i, 0.05);
        }
      }
      promos[n - 1] = 'bogo';
      history[n - 1] = opts.currentDeal ?? history[n - 1];
    }
    return { store, category, name, unit, history, promos, typical };
  };

  return [
    // Jewel
    mk('jewel-osco', 'meat', 'Italian Sausage Links', 'lb', 4.99, {
      rareBogoCurrent: true,
      currentDeal: 2.49,
      currentPromo: 'bogo',
    }),
    mk('jewel-osco', 'meat', 'Boneless Skinless Chicken Breasts', 'lb', 4.29, {
      currentDeal: 1.99,
      currentPromo: 'sale',
      saleFactor: 0.72,
    }),
    mk('jewel-osco', 'meat', '80 Lean Ground Beef', 'lb', 5.99, {
      currentDeal: 3.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'meat', 'Pork Loin Chops', 'lb', 3.99, { currentDeal: 2.49, currentPromo: 'sale' }),
    mk('jewel-osco', 'produce', 'Organic Avocados', 'each', 2.29, {
      currentDeal: 1.0,
      currentPromo: 'multi',
    }),
    mk('jewel-osco', 'produce', 'Honeycrisp Apples', 'lb', 3.29, { currentDeal: 1.99, currentPromo: 'sale' }),
    mk('jewel-osco', 'produce', 'Broccoli Crowns', 'lb', 2.29, { currentDeal: 1.48, currentPromo: 'sale' }),
    mk('jewel-osco', 'produce', 'Strawberries', 'each', 3.99, { currentDeal: 2.5, currentPromo: 'sale' }),
    mk('jewel-osco', 'dairy', 'Lucerne Large Eggs', 'each', 4.19, { currentDeal: 2.49, currentPromo: 'sale' }),
    mk('jewel-osco', 'dairy', 'Lucerne Whole Milk', 'oz', 4.29, { currentDeal: 2.99, currentPromo: 'sale' }),
    mk('jewel-osco', 'dairy', 'Tillamook Cheese Block', 'oz', 6.49, {
      currentDeal: 3.99,
      currentPromo: 'multi',
    }),
    mk('jewel-osco', 'dairy', 'Land O Lakes Butter', 'each', 5.49, { currentDeal: 3.99, currentPromo: 'sale' }),
    mk('jewel-osco', 'frozen', 'DiGiorno Rising Crust Pizza', 'each', 7.99, {
      currentDeal: 4.99,
      currentPromo: 'multi',
    }),
    mk('jewel-osco', 'frozen', "Ben & Jerry's Ice Cream", 'oz', 5.49, {
      currentDeal: 3.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'alcohol', 'La Marca Prosecco', 'each', 15.99, {
      currentDeal: 11.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'alcohol', 'White Claw Variety Pack', 'each', 21.99, {
      currentDeal: 16.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'pantry', 'Barilla Pasta', 'oz', 1.79, { currentDeal: 1.0, currentPromo: 'multi' }),
    mk('jewel-osco', 'pantry', "Rao's Homemade Marinara", 'oz', 7.99, {
      currentDeal: 5.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'snacks', "Lay's Classic Chips", 'oz', 4.29, {
      currentDeal: 2.5,
      currentPromo: 'multi',
    }),
    mk('jewel-osco', 'bakery', 'Oroweat Whole Grain Bread', 'oz', 4.79, {
      currentDeal: 2.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'household', 'Bounty Paper Towels', 'each', 14.99, {
      currentDeal: 9.99,
      currentPromo: 'sale',
    }),
    mk('jewel-osco', 'household', 'Tide Pods', 'each', 17.99, { currentDeal: 11.99, currentPromo: 'sale' }),
    mk('jewel-osco', 'deli', "Boar's Head Oven Gold Turkey", 'lb', 11.99, {
      currentDeal: 8.99,
      currentPromo: 'sale',
    }),
    // Aldi
    mk('aldi', 'meat', 'Never Any! Chicken Breast', 'lb', 3.19, { currentDeal: 2.49, currentPromo: 'sale' }),
    mk('aldi', 'meat', 'Italian Sausage', 'lb', 3.49, { currentDeal: 2.99, currentPromo: 'sale' }),
    mk('aldi', 'meat', 'Ground Chuck 80/20', 'lb', 4.29, { currentDeal: 3.69, currentPromo: 'sale' }),
    mk('aldi', 'meat', 'Salmon Fillets', 'lb', 8.99, { currentDeal: 6.99, currentPromo: 'sale' }),
    mk('aldi', 'produce', 'Avocados', 'each', 1.09, { currentDeal: 0.69, currentPromo: 'sale' }),
    mk('aldi', 'produce', 'Strawberries', 'each', 2.69, { currentDeal: 1.89, currentPromo: 'sale' }),
    mk('aldi', 'produce', 'Bananas', 'lb', 0.49, { currentDeal: 0.39, currentPromo: 'sale', amp: 0.12 }),
    mk('aldi', 'dairy', 'Friendly Farms Eggs Large', 'each', 2.45, {
      currentDeal: 1.85,
      currentPromo: 'sale',
    }),
    mk('aldi', 'dairy', 'Friendly Farms Whole Milk', 'oz', 3.25, {
      currentDeal: 2.65,
      currentPromo: 'sale',
    }),
    mk('aldi', 'dairy', 'Emporium Selection Cheddar', 'oz', 2.65, {
      currentDeal: 2.15,
      currentPromo: 'sale',
    }),
    mk('aldi', 'frozen', 'Casa Mamita Burritos', 'oz', 3.69, { currentDeal: 2.99, currentPromo: 'sale' }),
    mk('aldi', 'frozen', 'Specially Selected Ice Cream', 'oz', 3.49, {
      currentDeal: 2.85,
      currentPromo: 'sale',
    }),
    mk('aldi', 'alcohol', 'Winking Owl Cabernet', 'each', 3.45, { currentDeal: 2.95, currentPromo: 'sale' }),
    mk('aldi', 'pantry', 'Priano Pasta Sauce', 'oz', 2.09, { currentDeal: 1.69, currentPromo: 'sale' }),
    mk('aldi', 'pantry', "Dakota's Pride Black Beans", 'oz', 0.95, { noAutoSale: true, amp: 0.04 }),
    mk('aldi', 'pantry', "Dakota's Pride Pinto Beans", 'oz', 0.95, { noAutoSale: true, amp: 0.04 }),
    mk('aldi', 'pantry', "Dakota's Pride Chickpeas", 'oz', 0.99, { noAutoSale: true, amp: 0.04 }),
    mk('jewel-osco', 'pantry', 'La Preferida Pinto Beans Black Beans or Chickpeas', 'oz', 2.49, {
      rareBogoCurrent: true,
      currentDeal: 2.49,
      currentPromo: 'bogo',
    }),
    mk('aldi', 'pantry', 'Reggano Spaghetti', 'oz', 1.05, { currentDeal: 0.85, currentPromo: 'sale' }),
    mk('aldi', 'snacks', "Clancy's Potato Chips", 'oz', 1.69, { currentDeal: 1.35, currentPromo: 'sale' }),
    mk('aldi', 'bakery', "L'oven Fresh Bread", 'oz', 1.59, { currentDeal: 1.29, currentPromo: 'sale' }),
    mk('aldi', 'household', 'Alpine Fresh Paper Towels', 'each', 7.49, {
      currentDeal: 5.99,
      currentPromo: 'sale',
    }),
    mk('aldi', 'deli', 'Appleton Farms Honey Ham', 'lb', 4.99, { currentDeal: 3.99, currentPromo: 'sale' }),
    // Target
    mk('target', 'meat', 'Good & Gather Chicken Breast', 'lb', 3.99, {
      currentDeal: 2.99,
      currentPromo: 'sale',
    }),
    mk('target', 'meat', 'Good & Gather Ground Beef 85%', 'lb', 5.99, {
      currentDeal: 4.49,
      currentPromo: 'sale',
    }),
    mk('target', 'produce', 'Good & Gather Organic Blueberries', 'each', 4.49, {
      currentDeal: 2.99,
      currentPromo: 'sale',
    }),
    mk('target', 'produce', 'Bagged Mini Peppers', 'each', 3.69, {
      currentDeal: 2.5,
      currentPromo: 'sale',
    }),
    mk('target', 'dairy', 'Good & Gather Eggs', 'each', 3.49, { currentDeal: 2.29, currentPromo: 'sale' }),
    mk('target', 'dairy', 'Good & Gather Greek Yogurt 4-pack', 'each', 4.99, {
      currentDeal: 3.49,
      currentPromo: 'sale',
    }),
    mk('target', 'frozen', 'Good & Gather Frozen Pizza', 'each', 5.49, {
      currentDeal: 3.99,
      currentPromo: 'multi',
    }),
    mk('target', 'frozen', 'Favorite Day Ice Cream', 'oz', 3.49, {
      currentDeal: 2.79,
      currentPromo: 'sale',
    }),
    mk('target', 'alcohol', 'Barefoot Pinot Grigio', 'each', 9.99, {
      currentDeal: 7.99,
      currentPromo: 'sale',
    }),
    mk('target', 'alcohol', 'Truly Variety Pack', 'each', 18.99, {
      currentDeal: 14.99,
      currentPromo: 'sale',
    }),
    mk('target', 'pantry', 'Good & Gather Pasta', 'oz', 1.39, { currentDeal: 0.99, currentPromo: 'multi' }),
    mk('target', 'pantry', 'Good & Gather Olive Oil', 'oz', 9.49, {
      currentDeal: 6.99,
      currentPromo: 'sale',
    }),
    mk('target', 'snacks', 'Good & Gather Tortilla Chips', 'oz', 3.29, {
      currentDeal: 2.29,
      currentPromo: 'sale',
    }),
    mk('target', 'bakery', 'Market Pantry Bread', 'oz', 2.49, { currentDeal: 1.79, currentPromo: 'sale' }),
    mk('target', 'household', 'up & up Laundry Detergent', 'oz', 11.99, {
      currentDeal: 8.99,
      currentPromo: 'sale',
    }),
    mk('target', 'deli', 'Good & Gather Deli Turkey', 'lb', 7.49, {
      currentDeal: 5.99,
      currentPromo: 'sale',
    }),
  ];
}

function seedToStore(weeks) {
  const catalog = buildSeedCatalog(weeks);
  const items = catalog.map((item) => {
    const nName = norm(item.name);
    const points = item.history.map((price, wi) => ({
      weekStart: weeks[wi],
      price,
      unitPrice: item.unit === 'lb' || item.unit === 'each' ? price : undefined,
      promoType: item.promos[wi],
      onAd: item.promos[wi] !== 'plain',
      source: 'seed',
    }));
    return {
      key: `${item.store}::${nName}`,
      store: item.store,
      normalizedName: nName,
      unit: item.unit,
      category: item.category,
      points,
    };
  });
  return items;
}

// ---------- Merge helpers ----------
function upsertPoint(map, { store, name, unit, category, weekStart, price, unitPrice, promoType, onAd, source }) {
  const nName = norm(name);
  if (!nName || price == null) return;
  const key = `${store}::${nName}`;
  let item = map.get(key);
  if (!item) {
    item = {
      key,
      store,
      normalizedName: nName,
      unit,
      category: category || guessCategory(name),
      points: [],
    };
    map.set(key, item);
  }
  const rank = { seed: 1, 'flipp-archive': 2, 'flipp-live': 3 };
  const existing = item.points.find((p) => p.weekStart === weekStart);
  if (existing) {
    // Prefer real flipp data over seed for the same week
    if ((rank[source] || 0) >= (rank[existing.source] || 0)) {
      existing.price = price;
      existing.unitPrice = unitPrice ?? existing.unitPrice;
      existing.promoType = promoType;
      existing.onAd = onAd;
      existing.source = source;
    }
  } else {
    item.points.push({
      weekStart,
      price,
      unitPrice,
      promoType,
      onAd,
      source,
    });
  }
}

// ---------- Flipp fetch ----------
async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function searchZip(zip, query) {
  const qs = `locale=en-US&postal_code=${encodeURIComponent(zip)}&q=${encodeURIComponent(query)}`;
  return fetchJson(`${BASE}/flipp/items/search?${qs}`);
}

async function fetchFlyer(id) {
  return fetchJson(`${BASE}/flipp/flyers/${id}`);
}

async function runPool(tasks, concurrency, delayMs = 50) {
  let i = 0;
  const results = [];
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { error: e };
      }
      if (delayMs) await sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  console.log('Big Matt backfill — starting…');
  const weeks = buildSeedWeeks();
  console.log(`Seed weeks (${weeks.length}): ${weeks[0]} → ${weeks[weeks.length - 1]}`);

  const map = new Map();
  for (const item of seedToStore(weeks)) {
    map.set(item.key, item);
  }
  console.log(`Seeded ${map.size} staple items`);

  // Live search across ZIPs
  const flyerMeta = new Map(); // id -> { store, from, to }
  let liveHits = 0;
  const searchTasks = [];
  for (const zip of ZIPS) {
    for (const q of SEARCH_QUERIES) {
      searchTasks.push(async () => {
        const data = await searchZip(zip, q);
        return { zip, q, items: data.items || [] };
      });
    }
  }
  console.log(`Live search: ${searchTasks.length} requests across ${ZIPS.length} ZIPs…`);
  const searchResults = await runPool(searchTasks, 4, 60);

  for (const r of searchResults) {
    if (!r || r.error || !r.items) continue;
    for (const raw of r.items) {
      const store = matchStore(raw.merchant_name);
      if (!store) continue;
      const price = parsePrice(raw.current_price);
      if (price == null) continue;
      const name = (raw.name || '').trim();
      if (!name) continue;
      const from = weekStartFrom(raw.valid_from);
      const wk = mondayOf(from || weeks[weeks.length - 1]);
      const reg = parsePrice(raw.original_price);
      const promoType = detectPromo(
        `${raw.sale_story || ''} ${raw.pre_price_text || ''} ${raw.post_price_text || ''}`,
        price,
        reg,
      );
      const unit = /\blb\b|pound/i.test(raw.post_price_text || '')
        ? 'lb'
        : /each|ea\b/i.test(raw.post_price_text || '')
          ? 'each'
          : undefined;
      upsertPoint(map, {
        store,
        name,
        unit,
        category: guessCategory(name),
        weekStart: wk,
        price,
        unitPrice: unit === 'lb' || unit === 'each' ? price : undefined,
        promoType,
        onAd: true,
        source: 'flipp-live',
      });
      liveHits++;
      if (raw.flyer_id) {
        const id = Number(raw.flyer_id);
        if (!flyerMeta.has(id)) {
          flyerMeta.set(id, {
            store,
            from: raw.valid_from,
            to: raw.valid_to,
            merchant: raw.merchant_name,
          });
        }
      }
    }
  }
  console.log(`Live priced Jewel/Aldi/Target rows ingested: ${liveHits}`);
  console.log(`Unique flyer_ids from search: ${flyerMeta.size}`);

  // Fetch flyer details for known IDs
  const knownIds = [...flyerMeta.keys()];
  console.log(`Fetching ${knownIds.length} flyer details…`);
  const flyerTasks = knownIds.map((id) => async () => {
    const data = await fetchFlyer(id);
    return { id, data };
  });
  const flyerResults = await runPool(flyerTasks, 3, 80);
  let archiveItems = 0;
  for (const r of flyerResults) {
    if (!r || r.error || !r.data) continue;
    const meta = flyerMeta.get(r.id);
    const store = meta?.store;
    if (!store) continue;
    for (const it of r.data.items || []) {
      const price = parsePrice(it.price);
      if (price == null) continue;
      const name = (it.name || '').trim();
      if (!name) continue;
      const from = weekStartFrom(it.valid_from);
      const wk = mondayOf(from || weeks[weeks.length - 1]);
      upsertPoint(map, {
        store,
        name,
        brand: it.brand,
        category: guessCategory(name),
        weekStart: wk,
        price,
        promoType: it.discount ? 'sale' : 'sale',
        onAd: true,
        source: 'flipp-archive',
      });
      archiveItems++;
    }
  }
  console.log(`Archive items from known flyers: ${archiveItems}`);

  // Bounded nearby probes — recover still-hosted past weeks without hammering
  const probeSet = new Set();
  const deltas = [-60, -45, -30, -20, -15, -10, -8, -5, -3, -2, -1, 1, 2, 3, 5];
  for (const id of knownIds) {
    for (const d of deltas) probeSet.add(id + d);
  }
  // Also probe classic examples still known to exist
  for (const id of [8112353, 8052968, 8052955, 8113945, 8082539]) {
    for (const d of deltas) probeSet.add(id + d);
  }
  // Remove already fetched
  for (const id of knownIds) probeSet.delete(id);
  const probeIds = [...probeSet].filter((id) => id > 8000000 && id < 8200000).slice(0, 120);
  console.log(`Probing ${probeIds.length} nearby flyer ids (bounded)…`);

  const probeTasks = probeIds.map((id) => async () => {
    try {
      const data = await fetchFlyer(id);
      return { id, data };
    } catch (e) {
      return { id, error: e };
    }
  });
  const probeResults = await runPool(probeTasks, 4, 70);
  let probeHits = 0;
  let probeArchive = 0;
  for (const r of probeResults) {
    if (!r || r.error || !r.data?.items?.length) continue;
    const items = r.data.items;
    const from = weekStartFrom(items[0]?.valid_from);
    const to = weekStartFrom(items[0]?.valid_to);
    const days =
      from && to ? (Date.parse(to) - Date.parse(from)) / 86400000 : 999;
    // Prefer weekly-ish flyers; still keep long ones if grocery-looking
    let store = null;
    // Inherit store if close to a known flyer
    for (const [kid, meta] of flyerMeta) {
      if (Math.abs(kid - r.id) <= 5) {
        store = meta.store;
        break;
      }
    }
    if (!store) {
      for (const it of items.slice(0, 30)) {
        store = guessStoreFromItem(it.name, it.brand);
        if (store) break;
      }
    }
    if (!store) continue;
    // Skip obvious non-grocery if we only guessed weakly and window is weird
    const groceryCount = items.filter((it) =>
      /food|chicken|beef|milk|egg|bread|cheese|fruit|vegetable|pasta|chip|yogurt|butter|meat|produce/i.test(
        `${it.name} ${it.brand || ''}`,
      ),
    ).length;
    if (groceryCount < 3 && days > 21) continue;
    probeHits++;
    flyerMeta.set(r.id, { store, from, to, merchant: store });
    for (const it of items) {
      const price = parsePrice(it.price);
      if (price == null) continue;
      const name = (it.name || '').trim();
      if (!name) continue;
      const wk = mondayOf(weekStartFrom(it.valid_from) || from || weeks[weeks.length - 1]);
      upsertPoint(map, {
        store,
        name,
        category: guessCategory(name),
        weekStart: wk,
        price,
        promoType: 'sale',
        onAd: true,
        source: 'flipp-archive',
      });
      probeArchive++;
    }
  }
  console.log(`Probe flyers kept: ${probeHits}; archive rows added: ${probeArchive}`);

  // Sort points, drop items with no points
  const items = [...map.values()]
    .map((it) => ({
      ...it,
      points: [...it.points].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    }))
    .filter((it) => it.points.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));

  const payload = {
    locationLabel: 'Chicagoland (multi-ZIP backfill)',
    zip: '60610',
    updatedAt: new Date().toISOString(),
    notes:
      'Merged seed baselines + Flipp live search + still-hosted flyer archives. Flipp is not a full-year API; seed fills gaps so ranking works on day one.',
    items,
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2));

  // Stats
  let points = 0;
  const bySource = { seed: 0, 'flipp-archive': 0, 'flipp-live': 0, other: 0 };
  const allWeeks = new Set();
  for (const it of items) {
    for (const p of it.points) {
      points++;
      allWeeks.add(p.weekStart);
      if (bySource[p.source] != null) bySource[p.source]++;
      else bySource.other++;
    }
  }
  const sortedWeeks = [...allWeeks].sort();
  const pct = (n) => (points ? Math.round((n / points) * 1000) / 10 : 0);
  console.log('\n=== BACKFILL SUMMARY ===');
  console.log(`Items: ${items.length}`);
  console.log(`History points: ${points}`);
  console.log(`Date range: ${sortedWeeks[0]} → ${sortedWeeks[sortedWeeks.length - 1]} (${sortedWeeks.length} distinct weeks)`);
  console.log(
    `Sources: seed ${bySource.seed} (${pct(bySource.seed)}%), flipp-archive ${bySource['flipp-archive']} (${pct(bySource['flipp-archive'])}%), flipp-live ${bySource['flipp-live']} (${pct(bySource['flipp-live'])}%)`,
  );
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
