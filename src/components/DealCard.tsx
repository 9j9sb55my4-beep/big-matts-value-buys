import type { ScoredDeal } from '../types';
import { effectiveDealPrice } from '../lib/history';

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

export function DealCard({ deal }: Props) {
  const effective = deal.effectivePrice ?? effectiveDealPrice(deal);
  const typical = deal.analysis?.historicalTypical;
  const chips =
    deal.analysis?.reasonChips?.length
      ? deal.analysis.reasonChips
      : deal.reasons.slice(0, 3);

  return (
    <article className={`deal-card tier-${deal.tier}`}>
      <div className="deal-top">
        <span className="store-pill" data-store={deal.store}>
          {deal.storeLabel}
        </span>
        <span className={`tier-pill tier-${deal.tier}`}>{TIER_LABEL[deal.tier]}</span>
      </div>

      <h3 className="deal-name">
        {deal.brand ? <span className="brand">{deal.brand} · </span> : null}
        {deal.name}
      </h3>

      <div className="price-block">
        <div className="price-now">
          <span className="price-label">This week</span>
          <span className="price-value">{money(effective)}</span>
          {deal.bogo ? <span className="price-note">BOGO price each</span> : null}
          {deal.unit ? (
            <span className="price-unit">
              {deal.unitPrice != null
                ? `${money(deal.unitPrice)}/${deal.unit}`
                : `per ${deal.unit}`}
            </span>
          ) : null}
        </div>
        {typical != null ? (
          <div className="price-was">
            <span className="price-label">Usual price</span>
            <span className="price-typical">{money(typical)}</span>
            {deal.analysis && deal.analysis.dropVsTypicalPct >= 5 ? (
              <span className="price-delta">
                Save about {Math.round(deal.analysis.dropVsTypicalPct)}%
              </span>
            ) : null}
          </div>
        ) : deal.regPrice ? (
          <div className="price-was">
            <span className="price-label">Shelf price</span>
            <span className="price-typical">{money(deal.regPrice)}</span>
          </div>
        ) : null}
      </div>

      <div className="chip-row reason-chips">
        {chips.map((c) => (
          <span key={c} className="reason-chip">
            {c}
          </span>
        ))}
      </div>

      <div className="deal-meta">
        <span>
          Good {deal.validFrom.slice(5)} – {deal.validTo.slice(5)}
        </span>
        {deal.size ? <span>{deal.size}</span> : null}
      </div>

      {deal.flyerUrl ? (
        <a
          className="flyer-link"
          href={deal.flyerUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open store ad
        </a>
      ) : null}
    </article>
  );
}
