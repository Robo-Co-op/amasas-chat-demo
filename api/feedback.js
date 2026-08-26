// 各回答への可/不可+一言修正を記録(計画書Step2の収穫形式)
const SUPABASE_URL = "https://ugddjjnldavwrhfwtxwa.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messageId, verdict, comment } = req.body || {};
  if (!messageId || !["ok", "ng"].includes(verdict))
    return res.status(400).json({ error: "bad request" });

  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/amasas_chat_feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify([{ message_id: messageId, verdict, comment: comment || null }]),
  });
  if (!r.ok) return res.status(502).json({ error: await r.text() });
  return res.status(200).json({ ok: true });
}
