// The other admin operation that genuinely needs the service-role key:
// permanently removing a Supabase Auth user (GoTrue Admin API). The
// admin_users row is removed first via admin_delete_user, called with the
// caller's OWN token -- that's the real permission check (owner-only, no
// self-delete), not the presence of a service key. Only after that succeeds
// do we reach for the service key, to fully revoke the account's sessions
// and free its email for reuse (deactivation via admin_set_user does neither).
const SUPABASE_URL = "https://jcokpgmqmtxefzjjenrx.supabase.co";
const ANON_KEY = "sb_publishable_vw8EmUrhPDKBnD7BF0a8kA_N0DPF-es";

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
  if (rateLimited()) return res.status(429).json({ error: "削除操作が続けて行われています。しばらく待ってから再試行してください" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const { target_id } = req.body || {};
  if (!target_id) return res.status(400).json({ error: "bad request" });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_KEY が未設定のため削除できません" });

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_delete_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ target_id }),
  });
  const delData = await delRes.json();
  if (!delRes.ok) {
    const msg = (delData && delData.message) || "";
    if (/forbidden/i.test(msg)) return res.status(403).json({ error: "この操作を行う権限がありません" });
    if (/cannot delete your own account/i.test(msg)) return res.status(400).json({ error: "自分自身は削除できません" });
    if (/user not found/i.test(msg)) return res.status(404).json({ error: "ユーザーが見つかりません" });
    return res.status(502).json({ error: msg || "管理者の削除に失敗しました" });
  }

  // admin_users row is gone at this point. Best-effort from here: if the auth
  // account removal fails, the user has already lost admin access (no row =
  // no role), so we still report success rather than leave the caller stuck
  // retrying a delete that already took effect where it matters.
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target_id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!authRes.ok && authRes.status !== 404) {
    const errData = await authRes.json().catch(() => ({}));
    return res.status(200).json({
      ok: true,
      warning: "管理者権限は削除されましたが、アカウント自体の削除には失敗しました: " + (errData.msg || errData.error_description || authRes.status),
    });
  }

  return res.status(200).json({ ok: true });
}
