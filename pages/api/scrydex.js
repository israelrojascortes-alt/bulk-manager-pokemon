// pages/api/scrydex.js
// Server-side scraper para precios de Scrydex (sin API key)

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { name, set, number } = req.query;
  if (!name || !set || !number) return res.status(400).json({ error: "Faltan parámetros" });

  try {
    const slug = name.toLowerCase()
      .replace(/[àáâãäå]/g,"a").replace(/[èéêë]/g,"e")
      .replace(/[ìíîï]/g,"i").replace(/[òóôõö]/g,"o")
      .replace(/[ùúûü]/g,"u").replace(/[^a-z0-9]+/g,"-")
      .replace(/^-|-$/g,"");

    const numClean = String(number).split("/")[0].replace(/^0+/,"");
    const setLower = set.toLowerCase();

    const url = `https://scrydex.com/pokemon/cards/${slug}/${setLower}_ja-${numClean}`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BulkManager/1.0)",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });

    if (!r.ok) return res.status(404).json({ error: "Carta no encontrada", url });

    const html = await r.text();

    // Extract NM price — look for dollar amounts near "Near Mint" text
    // Scrydex shows prices like: Near Mint\n$279.11
    const priceMatches = html.match(/\$(\d{1,4}(?:\.\d{2})?)/g) || [];
    const prices = priceMatches
      .map(p => parseFloat(p.replace("$","")))
      .filter(p => p > 0.5 && p < 5000)
      .sort((a,b) => a - b);

    // Also try to find the specific NM price from structured content
    const nmMatch = html.match(/Near Mint[^$]*\$(\d+\.?\d*)/);
    const nmPrice = nmMatch ? parseFloat(nmMatch[1]) : null;

    // Best estimate: NM match or median of extracted prices
    const bestPrice = nmPrice || (prices.length > 0 ? prices[Math.floor(prices.length/2)] : null);

    if (!bestPrice) return res.status(404).json({ error: "Precio no encontrado", url });

    return res.status(200).json({
      usd: bestPrice,
      clp: Math.round(bestPrice * 950),
      source: "scrydex",
      url,
      conf: "h",
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
