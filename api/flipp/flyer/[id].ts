import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy Wishabi/Flipp flyer detail.
 * Mirrors Vite: /api/flipp/flyer/:id -> /flipp/flyers/:id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = String(req.query.id ?? '').trim();
  if (!id) {
    return res.status(400).json({ error: 'Missing flyer id' });
  }

  const url = 'https://backflipp.wishabi.com/flipp/flyers/' + encodeURIComponent(id);

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    const body = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstream.status).setHeader('Content-Type', contentType);
    return res.send(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: 'Upstream Flipp flyer failed', message });
  }
}
