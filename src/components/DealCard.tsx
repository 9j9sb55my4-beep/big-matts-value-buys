import type { ScoredDeal } from '../types';
import { effectiveDealPrice } from '../lib/history';
import { formatUnitPrice } from '../lib/sizeParse';

interface Props {
  deal: ScoredDeal;
}

const TIER_LABEL: Record<string, string> = {
  steal: 'Best deal',
  good: 'Good deal',
  ok: 'Okay deal',
};

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function shortStoreLabel(store: string, label: string): string {
  if (store === 'jewel-osco') return 'Jewel';
  return label;
}

export function DealCard({ deal }: Props) {
  const effective = deal.effectivePrice ?? effectiveDealPrice(deal);
  const typical = deal.analysis?.historicalTypical;
  const chips =
    deal.analysis?.reasonChips?.length
      ? deal.analysis.reasonChips
          .filter((c) => !/still cheaper|beats this|Better at|Compare:/i.test(c))
          .slice(0, 2)
      : deal.reasons
          .filter((c) => !/still cheaper|beats this|Better at|Compare:/i.test(c))
          .slice(0, 2);
  const cross = deal.crossStore;
  const winner = !cross && deal.isCrossStoreWinner;
  const sizeLabel = deal.size?.trim();
  const unitPriceLabel =
    deal.unitPrice != null && deal.unit
      ? formatUnitPrice(deal.unitPrice, deal.unit)
      : undefined;

  return (
    <article
      className={`deal-card tier-${deal.tier}${cross ? ' has-cross-alert' : ''}${
        winner ? ' is-winner' : ''
      }`}
    >
      <div className="deal-top">
        <span className="store-pill" data-store={deal.store}>
          {deal.storeLabel}
        </span>
        {cross ? (
          <span className="cross-badge cheaper">Cheaper elsewhere</span>
        ) : winner ? (
          <span className="cross-badge best">Best across stores</span>
        ) : (
          <span className={`tier-pill tier-${deal.tier}`}>{TIER_LABEL[deal.tier]}</span>
        )}
      </div>

      {cross ? (
        <div className="cross-alert" role="status">
          <span className="cross-alert-flag" aria-hidden>
            ⚠
          </span>
          <strong className="cross-alert-text">{cross.alert.replace(/^⚠\s*/, '')}</strong>
          {cross.proofUrl ? (
            <a
              className="cross-proof-link"
              href={cross.proofUrl}
              target="_blank"
              rel="noreferrer"
            >
              See at {shortStoreLabel(cross.store, cross.storeLabel)}
            </a>
          ) : null}
        </div>
      ) : null}

      <h3 className="deal-name">
        {deal.brand ? <span className="brand">{deal.brand} · </span> : null}
        {deal.name}
      </h3>
      {sizeLabel ? (
        <p className="deal-size">{sizeLabel}</p>
      ) : (
        <p className="deal-size missing">Size not listed</p>
      )}

      <div className="price-block">
        <div className="price-now">
          <span className="price-label">This week</span>
          <span className="price-value">{money(effective)}</span>
          {deal.bogo ? <span className="price-note">BOGO each</span> : null}
          {unitPriceLabel ? (
            <span className="price-unit prominent">{unitPriceLabel}</span>
          ) : null}
        </div>
        {typical != null ? (
          <div className="price-was">
            <span className="price-label">Usual here</span>
            <span className="price-typical">{money(typical)}</span>
            {deal.analysis && deal.analysis.dropVsTypicalPct >= 5 && !cross ? (
              <span className="price-delta">
                ~{Math.round(deal.analysis.dropVsTypicalPct)}% off
              </span>
            ) : null}
          </div>
        ) : deal.regPrice ? (
          <div className="price-was">
            <span className="price-label">Shelf</span>
            <span className="price-typical">{money(deal.regPrice)}</span>
          </div>
        ) : null}
      </div>

      <div className="deal-foot">
        {chips.length > 0 ? (
          <div className="chip-row reason-chips">
            {chips.map((c) => (
              <span key={c} className="reason-chip">
                {c}
              </span>
            ))}
          </div>
        ) : null}
        <div className="deal-meta">
          <span>
            {deal.validFrom.slice(5)}–{deal.validTo.slice(5)}
          </span>
          {deal.flyerUrl ? (
            <a
              className="flyer-link"
              href={deal.flyerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Store ad
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
