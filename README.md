# Big Matts Value Buys

Compare Jewel-Osco, Aldi, and Target weekly ads for any US ZIP (default 60610).
Cross-checks Jewel, Aldi & Target for the real best price — sale and everyday.

## Quick start

Install deps, run the history backfill script, then start Vite.

## ZIP codes

- Any US ZIP. Default 60610. Chicagoland tips: 60647, 60614, 60540, 60007, 60453.
- Outside 600-608 we still try live flyers (not River-North-only).

## Data sources (honest)

### Live weekly ads (Flipp / Wishabi)

Public search (no access token):

GET https://backflipp.wishabi.com/flipp/items/search?locale=en-US&postal_code={ZIP}&q={query}

Dev proxies (CORS):
- /api/flipp/search -> Wishabi items/search
- /api/flipp/flyer -> Wishabi /flipp/flyers/{id}

Flyer detail returns items with valid_from/valid_to for SOME still-hosted IDs. Arbitrary old IDs often 404. Flipp does NOT offer a clean multi-year archive API.

FlyerKit needs a Flipp-issued access_token and is not used in the production path.

If live search fails, the UI falls back to labeled demo data (public/demo-week.json).

### Price history backline

public/price-history.json ships with a strong day-one backline so ranking works on first open:

| source | Meaning |
|--------|---------|
| seed | Plausible multi-week baselines for Chicagoland staples |
| flipp-archive | Still-hosted Flipp flyer detail pages |
| flipp-live | Live search and client-side weekly upserts |

Refresh with the backfill script under scripts/. Ongoing weekly append on each live pull.

## Ranking

1. Primary: true lowest comparable price across Jewel / Aldi / Target (sale + everyday/ecom + history)
2. Secondary: drop vs recent typical, rare BOGO, unusual promo
3. Tertiary: unit price, multi-buy math, percent off shelf/reg
4. Deals beaten by another store lose "Best deal", get a hard-to-miss alert, and rank lower

## Scripts

- dev: Vite + Flipp proxies
- build: typecheck + production build
- backfill: rebuild price-history.json (seed + Flipp)
- generate-demo: regenerate demo week + short seed history

## Deploy on Vercel (free Hobby)

Live Flipp ads work in production via serverless proxies under `api/flipp/` (same `/api/flipp/search?...` paths the client already uses). Local Vite proxies stay for `npm run dev`.

1. Push this repo to GitHub (public or private).
2. Go to vercel.com, sign in, and Import the GitHub repository.
3. Use the Hobby (free) plan. Framework preset can stay blank — `vercel.json` sets buildCommand (`npm run build`) and outputDirectory (`dist`).
4. Deploy. No env vars required for live Flipp search.
5. After deploy, open the site, enter a ZIP, and confirm deals load from live ads (not only demo fallback).

SPA routes rewrite to `index.html`; `/api/*` serverless functions are matched first and are not broken by that rewrite.

## Notes

- Logo: /big-matt-logo.png
- Flipp is not a year-long price DB; we combine seed + still-hosted flyers + weekly append.
