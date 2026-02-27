function headerGet(req, key) {
  // Supports:
  // - Next Request: req.headers.get("authorization")
  // - Node/Express-ish: req.headers.authorization
  try {
    if (req?.headers?.get) return req.headers.get(key) || req.headers.get(key.toLowerCase()) || null;
  } catch {}
  const h = req?.headers || {};
  return h[key] || h[key.toLowerCase()] || null;
}

function getBearerToken(req) {
  const h = headerGet(req, "authorization");
  if (!h) return null;
  const s = String(h).trim();
  if (!s) return null;

  // Accept "Bearer <token>" or "bearer <token>"
  const m = s.match(/^bearer\s+(.+)$/i);
  return (m ? m[1] : s).trim() || null;
}

function getCookie(req, name) {
  const raw = headerGet(req, "cookie") || "";
  if (!raw) return null;

  const parts = String(raw)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
}

function getAnyAuthToken(req) {
  // Prefer Supabase Bearer when present; fall back to dashboard token cookie
  return getBearerToken(req) || getCookie(req, "chiefos_dashboard_token");
}

module.exports = { getAnyAuthToken };