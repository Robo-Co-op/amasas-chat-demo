// Public analytics beacon: landing_view / chat_started only. Everything else
// the Analytics dashboard needs (messages, feedback) already lives in
// amasas_chat_messages/amasas_chat_feedback -- not duplicated here.
// No auth, no rate limit -- same trust model as api/chat.js and
// api/feedback.js (neither has one either). Never receives or stores chat
// content, credentials, or tokens -- only structured, non-identifying
// request metadata.
const SUPABASE_URL = "https://jcokpgmqmtxefzjjenrx.supabase.co";
const EVENT_TYPES = ["landing_view", "chat_started"];

// Minimal, dependency-free UA classifier -- directionally useful for an
// admin chart, not a precise fingerprinting tool. Matches this repo's
// zero-npm-dependency convention for api/*.js.
function parseUserAgent(ua) {
  ua = ua || "";
  let deviceType = "desktop";
  if (/ipad|tablet(?!.*mobile)/i.test(ua)) deviceType = "tablet";
  else if (/mobi|iphone|android/i.test(ua)) deviceType = "mobile";

  let browser = "other";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/(chrome|crios)\//i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  let os = "other";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { deviceType, browser, os };
}

async function logToDb(rows) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/amasas_analytics_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
    return r.ok;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { event_type, session_id, visitor_id, referrer, metadata } = req.body || {};
  if (!EVENT_TYPES.includes(event_type)) return res.status(400).json({ error: "bad request" });

  const { deviceType, browser, os } = parseUserAgent(req.headers["user-agent"]);

  await logToDb([{
    session_id: typeof session_id === "string" ? session_id.slice(0, 100) : null,
    visitor_id: typeof visitor_id === "string" ? visitor_id.slice(0, 100) : null,
    event_type,
    device_type: deviceType,
    browser,
    os,
    country: req.headers["x-vercel-ip-country"] || null,
    region: req.headers["x-vercel-ip-country-region"] || null,
    referrer: typeof referrer === "string" ? referrer.slice(0, 500) : null,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
  }]);

  return res.status(204).end();
}
