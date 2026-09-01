// System-health panel for the admin dashboard. Reports env-var *presence*
// only (never values) plus a live read-only DB ping — the values themselves
// live in Vercel project settings and can't be read or changed from here.
const SUPABASE_URL = "https://jcokpgmqmtxefzjjenrx.supabase.co";
const ANON_KEY = "sb_publishable_vw8EmUrhPDKBnD7BF0a8kA_N0DPF-es";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const whoRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_whoami`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: "{}",
  });
  const profile = whoRes.ok ? await whoRes.json() : null;
  if (!profile) return res.status(403).json({ error: "forbidden" });

  let dbReachable = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/amasas_query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ query: "select 1 as ok" }),
    });
    const j = await r.json();
    dbReachable = r.ok && Array.isArray(j) && j.length > 0;
  } catch {
    dbReachable = false;
  }

  return res.status(200).json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
    serviceKeyConfigured: !!process.env.SUPABASE_SERVICE_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite（既定）",
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite（既定）",
    dataLayer: ["ai", "l4"].includes(process.env.DATA_LAYER) ? process.env.DATA_LAYER : "amasas（既定）",
    dbReachable,
  });
}
