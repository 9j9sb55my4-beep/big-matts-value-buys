export function HowItWorks() {
  return (
    <details className="how-it-works">
      <summary>How we pick the best deals</summary>
      <ol>
        <li>
          We pull this week&apos;s Jewel-Osco, Aldi, and Target flyer items for{' '}
          <strong>your ZIP</strong> (live Flipp search — no token needed).
        </li>
        <li>We compare each price to recent weeks (what it usually costs).</li>
        <li>Rare BOGOs, big price drops, and smart multi-buys rise to the top.</li>
        <li>
          We flag when the same kind of item is better at another store.
        </li>
      </ol>
      <p className="muted">
        Labels like <strong>Best deal</strong>, <strong>Price dropped</strong>, and{' '}
        <strong>Rare good deal</strong> mean it&apos;s a better buy than usual — not
        just &quot;on sale.&quot; If live flyers can&apos;t load, we show labeled demo
        data so you&apos;re never left guessing.
      </p>
    </details>
  );
}
