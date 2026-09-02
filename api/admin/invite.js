// The one admin operation that genuinely needs the service-role key: creating
// a brand-new Supabase Auth user (GoTrue Admin API) and sending the invite
// email. Everything else in the admin app (role changes, knowledge edits,
// settings) goes through RPCs called with the signed-in admin's own token —
// see supabase/migrations/0006_admin.sql.
const SUPABASE_URL = "https://jcokpgmqmtxefzjjenrx.supabase.co";
const ANON_KEY = "sb_publishable_vw8EmUrhPDKBnD7BF0a8kA_N0DPF-es";
const ROLES = ["owner", "admin", "editor", "viewer"];

// Best-effort per-instance rate limit (serverless has no shared state without
// extra infra like Upstash — this just blunts accidental/rapid retries).
const hits = [];
function rateLimited() {
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 10) return true;
  hits.push(now);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (rateLimited()) return res.status(429).json({ error: "招待が続けて行われています。しばらく待ってから再試行してください" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const { email, role, displayName } = req.body || {};
  if (!email || !ROLES.includes(role)) return res.status(400).json({ error: "bad request" });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_KEY が未設定のため招待できません" });

  const whoRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_whoami`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: "{}",
  });
  const callerProfile = whoRes.ok ? await whoRes.json() : null;
  if (!callerProfile || !["owner", "admin"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "招待する権限がありません" });
  }
  if (callerProfile.role === "admin" && (role === "owner" || role === "admin")) {
    return res.status(403).json({ error: "admin ロールは owner / admin を招待できません" });
  }

  // Redirects back to the same host the invite was sent from — there are
  // multiple Vercel deployments of this app (see README), so a single
  // hardcoded Site URL in Supabase's dashboard can't cover all of them.
  // Requires the exact URL (or a matching pattern) to be in Supabase's
  // Authentication → URL Configuration → Redirect URLs allowlist, or GoTrue
  // silently falls back to the dashboard's default Site URL instead.
  const redirectTo = `https://${req.headers.host}/admin/login.html`;

  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ email }),
  });
  const inviteData = await inviteRes.json();
  if (!inviteRes.ok) {
    return res.status(502).json({ error: inviteData.msg || inviteData.error_description || "招待メールの送信に失敗しました" });
  }

  // admin_register_user re-applies the same owner/admin escalation rules
  // server-side (SQL), using the caller's OWN token — not the service key.
  const regRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_register_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ new_id: inviteData.id, new_email: email, new_role: role, new_display_name: displayName || null }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) {
    return res.status(502).json({ error: (regData && regData.message) || "招待メールは送信されましたが、管理者登録に失敗しました" });
  }

  return res.status(200).json({ ok: true, user: regData });
}
