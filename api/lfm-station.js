// Vercel serverless proxy for Last.fm station endpoint (CORS workaround).
// Usage: /api/lfm-station?user=<username>

export default async function handler(req, res) {
  var user = req.query.user;
  if (!user || typeof user !== 'string' || !/^[\w\-. ]+$/.test(user)) {
    return res.status(400).json({ error: 'missing or invalid user param' });
  }

  var upstream = 'https://www.last.fm/player/station/user/' + encodeURIComponent(user) + '/recommended';
  var upstream_res = await fetch(upstream, { headers: { 'Accept': 'application/json' } });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(upstream_res.status);

  var body = await upstream_res.text();
  res.send(body);
}
