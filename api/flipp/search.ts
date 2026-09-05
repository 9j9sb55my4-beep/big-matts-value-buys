import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Proxy Wishabi/Flipp item search so the browser avoids CORS on Vercel.
 * Mirrors Vite dev proxy: /api/flipp/search -> /flipp/items/search
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const locale = String(req.query.locale ?? "en-US");
  const postal_code = String(req.query.postal_code ?? "");
  const q = String(req.query.q ?? "");

  const url = new URL("https://backflipp.wishabi.com/flipp/items/search");
  url.searchParams.set("locale", locale);
  url.searchParams.set("postal_code", postal_code);
  url.searchParams.set("q", q);

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const body = await upstream.text();
    const contentType =
      upstream.headers.get("content-type") || "application/json; charset=utf-8";
    res.status(upstream.status).setHeader("Content-Type", contentType);
    return res.send(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Upstream Flipp search failed", message });
  }
}
