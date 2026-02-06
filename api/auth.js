export default function handler(req, res) {
  // Vercel Node serverless function
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let password = '';
  if (req.body && typeof req.body === 'object') {
    password = req.body.password || '';
  } else {
    // try to read raw body if not parsed
    try {
      const raw = req.read();
      if (raw) {
        const parsed = JSON.parse(raw.toString());
        password = parsed.password || '';
      }
    } catch (e) {
      // ignore
    }
  }

  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  if (password === secret) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
}
