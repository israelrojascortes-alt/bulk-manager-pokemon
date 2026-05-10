// pages/api/tcgdex.js
// Proxy para TCGdex — evita bloqueos CORS desde el browser

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: "path requerido" });

  const url = `https://api.tcgdex.net/v2/${path}`;

  try {
    const r = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "BulkManagerPokemon/1.0",
      }
    });

    if (!r.ok) return res.status(r.status).json({ error: `TCGdex error ${r.status}` });

    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
