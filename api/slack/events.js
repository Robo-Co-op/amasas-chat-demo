// Slack版AMASAS: Slack Events API(HTTP)の受け口。
// - 署名を検証して3秒以内に200を返し、AI処理はwaitUntilで応答後に非同期実行する
// - 会話履歴はSupabaseのslack_*テーブル(Web版のamasas_chat_*とは別)に保存。再起動後も残る
// - 同じメッセージの再送・mention+messageの二重通知はslack_eventsで重複排除
// - 同一会話のターンはロックで直列化し、Slack全体の同時実行数も上限を設ける(Web版の枠を食わない)
// Tachikoma/Robo Operatorは経由しない。Slack APIとGemini、Supabaseに直接つなぐ。
import { waitUntil } from "@vercel/functions";
import { SUPABASE_URL, DATA_LAYER, DEFAULT_MODEL, runAgent, getMaintenanceStatus, sleep } from "../../lib/amasas-agent.js";
import { verifySlackSignature, classifyEvent, toSlackMrkdwn, chunkText, buildSlackSystemPrompt } from "../../lib/slack.js";

const MODEL = process.env.SLACK_GEMINI_MODEL || DEFAULT_MODEL;
const MAX_CONCURRENT = Math.max(1, Number(process.env.SLACK_MAX_CONCURRENT) || 4);
const HISTORY_LIMIT = 20; // Geminiに渡す直近の発言数
const FUNCTION_BUDGET_MS = 55 * 1000; // vercel.jsonのmaxDuration(60秒)より手前で必ず決着させる
const LOCK_WAIT_MS = 15 * 1000; // 同じ会話の前のターンを待つ上限
const LOCK_TTL_SECONDS = 90; // インスタンスが落ちてもこの秒数でロックは自然に外れる

const MSG = {
  thinking: ":hourglass_flowing_sand: 考えています… / Thinking…",
  busyConversation: "前の質問にまだ回答中です。回答が出てからもう一度送ってください。\nI'm still answering the previous message in this conversation — please send this again once it's done.",
  busyGlobal: "ただいま混み合っています。1分ほど待ってからもう一度お試しください。\nI'm handling too many requests right now — please try again in a minute.",
  timeout: "回答に時間がかかりすぎたため中断しました。質問を短くするか、もう一度お試しください。\nThis took too long and was stopped — please try again or ask a shorter question.",
  overloaded: "ただいまAIが混み合っています。1分ほど待ってからもう一度お試しください。\nThe AI service is busy right now — please try again in a minute.",
  error: "処理中にエラーが発生しました。もう一度お試しください。\nSomething went wrong while answering — please try again.",
};

const log = (fields) => console.log(JSON.stringify({ src: "slack", ...fields }));

export async function POST(request) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !process.env.SLACK_BOT_TOKEN) {
    log({ level: "error", msg: "SLACK_SIGNING_SECRET or SLACK_BOT_TOKEN not configured" });
    return new Response("not configured", { status: 503 });
  }
  const ok = verifySlackSignature({
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    secret,
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (body.type === "url_verification") return Response.json({ challenge: body.challenge });

  if (body.type === "event_callback") {
    const retry = request.headers.get("x-slack-retry-num");
    if (retry) log({ msg: "retry received", eventId: body.event_id, retry, reason: request.headers.get("x-slack-retry-reason") });
    waitUntil(
      handleEvent(body, startedAt).catch((e) =>
        log({ level: "error", msg: "unhandled", eventId: body.event_id, error: String(e?.stack || e) })
      )
    );
  }
  return new Response("", { status: 200 });
}

export function GET() {
  return new Response("POST only", { status: 405 });
}

// ---- Supabase(service_role)。slack_*テーブルはRLSでservice_role以外から見えない ----
async function db(path, { method = "GET", body, prefer } = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase ${method} ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const text = await r.text(); // return=minimalの201/204は本文が空
  return text ? JSON.parse(text) : null;
}
const rpc = (name, args) => db(`rpc/${name}`, { method: "POST", body: args });

// ---- Slack Web API ----
async function slack(method, payload) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (r.status === 429 && attempt < 2) {
      await sleep(Math.min(Number(r.headers.get("retry-after")) || 1, 5) * 1000);
      continue;
    }
    const j = await r.json();
    if (!j.ok) throw new Error(`slack ${method}: ${j.error}`);
    return j;
  }
}

let botUserIdCache = process.env.SLACK_BOT_USER_ID || null;
async function getBotUserId(body) {
  const fromPayload = body.authorizations?.find((a) => a.is_bot)?.user_id || body.authorizations?.[0]?.user_id;
  if (fromPayload) return fromPayload;
  if (!botUserIdCache) botUserIdCache = (await slack("auth.test", {})).user_id;
  return botUserIdCache;
}

async function handleEvent(body, startedAt) {
  const deadline = startedAt + FUNCTION_BUDGET_MS;
  if (!process.env.SUPABASE_SERVICE_KEY) {
    // 重複排除も履歴保存もできない状態で返信すると重複・文脈喪失が起きるので処理しない
    log({ level: "error", msg: "SUPABASE_SERVICE_KEY not configured; event dropped", eventId: body.event_id });
    return;
  }
  const ev = classifyEvent(body, await getBotUserId(body));
  if (!ev) return;

  // メンションなしのスレッド返信は、ボットが会話している既存スレッドのときだけ答える
  if (ev.kind === "thread") {
    const rows = await db(`slack_conversations?key=eq.${encodeURIComponent(ev.convKey)}&select=key`);
    if (!rows.length) return;
  }

  const claimed = await rpc("slack_claim_event", {
    p_event_key: ev.eventKey,
    p_event_id: ev.eventId,
    p_conversation_key: ev.convKey,
  });
  if (claimed !== true) {
    log({ msg: "duplicate ignored", eventKey: ev.eventKey, eventId: ev.eventId });
    return;
  }

  const meta = { eventKey: ev.eventKey, eventId: ev.eventId, kind: ev.kind, conv: ev.convKey };
  const post = (text) => slack("chat.postMessage", { channel: ev.channel, text, ...(ev.replyThreadTs ? { thread_ts: ev.replyThreadTs } : {}) });
  const finish = (status, error) =>
    db(`slack_events?event_key=eq.${encodeURIComponent(ev.eventKey)}`, {
      method: "PATCH",
      body: { status, error: error || null, duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString() },
    }).catch((e) => log({ level: "error", msg: "event status update failed", ...meta, error: String(e) }));

  const maintenance = await getMaintenanceStatus();
  if (maintenance && maintenance.enabled) {
    await post(maintenance.message || "ただいまメンテナンス中です。しばらくしてから再度お試しください。");
    await finish("rejected", "maintenance");
    return;
  }

  // 同じ会話の前のターンが終わるまで待つ(履歴の書き込みが交差しないように)
  let lock;
  const waitUntilTs = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    lock = await rpc("slack_acquire_turn", {
      p_key: ev.convKey,
      p_team: ev.team,
      p_channel: ev.channel,
      p_thread_ts: ev.threadTs,
      p_is_dm: ev.isDm,
      p_owner: ev.eventKey,
      p_ttl_seconds: LOCK_TTL_SECONDS,
      p_max_concurrent: MAX_CONCURRENT,
    });
    if (lock === "ok" || Date.now() > waitUntilTs) break;
    await sleep(1500);
  }
  if (lock !== "ok") {
    await post(lock === "busy_global" ? MSG.busyGlobal : MSG.busyConversation);
    await finish("rejected", lock);
    log({ msg: "rejected", ...meta, reason: lock });
    return;
  }

  let placeholder = null;
  let statusChain = Promise.resolve();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(5000, deadline - Date.now() - 3000));
  try {
    placeholder = await post(MSG.thinking);

    let lastStatusAt = 0;
    const onStatus = (text) => {
      if (Date.now() - lastStatusAt < 1500) return;
      lastStatusAt = Date.now();
      statusChain = statusChain
        .then(() => slack("chat.update", { channel: ev.channel, ts: placeholder.ts, text: `:hourglass_flowing_sand: _${text}_` }))
        .catch(() => {});
    };

    const history = await db(
      `slack_messages?conversation_key=eq.${encodeURIComponent(ev.convKey)}&select=role,content&order=id.desc&limit=${HISTORY_LIMIT}`
    );
    const contents = history
      .reverse()
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    contents.push({ role: "user", parts: [{ text: ev.text }] });

    const sysText = await buildSlackSystemPrompt(DATA_LAYER);
    const { answer, sqlLog } = await runAgent({
      model: MODEL,
      layer: DATA_LAYER,
      sysText,
      contents,
      onStatus,
      apiKey: process.env.SLACK_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      signal: ac.signal,
    });
    clearTimeout(timer);

    await statusChain; // 古い途中経過が最終回答を上書きしないように
    const chunks = chunkText(toSlackMrkdwn(answer || MSG.error));
    await slack("chat.update", { channel: ev.channel, ts: placeholder.ts, text: chunks[0] });
    for (const c of chunks.slice(1)) await post(c);

    // 履歴は成功したターンだけ、ユーザー→アシスタントの1組で保存(回答の配信を優先し、保存失敗はログに残す)
    await db("slack_messages", {
      method: "POST",
      prefer: "return=minimal",
      body: [
        { conversation_key: ev.convKey, role: "user", content: ev.text, slack_user: ev.user, slack_ts: ev.ts },
        { conversation_key: ev.convKey, role: "assistant", content: answer, sql_log: sqlLog, data_layer: DATA_LAYER, model: MODEL },
      ],
    }).catch((e) => log({ level: "error", msg: "history save failed", ...meta, error: String(e) }));

    await finish("done");
    log({ msg: "answered", ...meta, ms: Date.now() - startedAt, sqlCount: sqlLog.length, chars: answer.length, parts: chunks.length });
  } catch (e) {
    clearTimeout(timer);
    const text = ac.signal.aborted
      ? MSG.timeout
      : /high demand|overloaded|429|503/i.test(String(e?.message))
        ? MSG.overloaded
        : MSG.error;
    log({ level: "error", msg: "turn failed", ...meta, aborted: ac.signal.aborted, error: String(e?.message || e) });
    await statusChain;
    try {
      if (placeholder) await slack("chat.update", { channel: ev.channel, ts: placeholder.ts, text });
      else await post(text);
    } catch (e2) {
      log({ level: "error", msg: "could not deliver error message", ...meta, error: String(e2?.message || e2) });
    }
    await finish("failed", String(e?.message || e).slice(0, 500));
  } finally {
    await rpc("slack_release_turn", { p_key: ev.convKey, p_owner: ev.eventKey }).catch((e) =>
      log({ level: "error", msg: "lock release failed (expires on its own)", ...meta, error: String(e) })
    );
  }
}
