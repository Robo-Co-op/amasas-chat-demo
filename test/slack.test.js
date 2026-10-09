// node --test test/  — Slack版の単体テストと、偽のSlack/Supabase/Geminiを使った結合テスト
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.SLACK_SIGNING_SECRET = "test-secret";
process.env.SLACK_BOT_TOKEN = "xoxb-test";
process.env.SUPABASE_SERVICE_KEY = "service-test";
process.env.GEMINI_API_KEY = "gemini-test";
process.env.SLACK_MAX_CONCURRENT = "4";
process.env.SLACK_AI_RETRY_WAITS_MS = "50";

const { verifySlackSignature, classifyEvent, toSlackMrkdwn, chunkText, cleanText } = await import("../lib/slack.js");
const { POST } = await import("../api/slack/events.js");
const { runAgent } = await import("../lib/amasas-agent.js");

const BOT = "UBOT";
const sign = (raw, ts = Math.floor(Date.now() / 1000)) =>
  ({ ts: String(ts), sig: "v0=" + createHmac("sha256", "test-secret").update(`v0:${ts}:${raw}`).digest("hex") });

// ---------------- 単体テスト ----------------

test("signature: valid, tampered, stale, missing", () => {
  const raw = '{"a":1}';
  const { ts, sig } = sign(raw);
  assert.equal(verifySlackSignature({ rawBody: raw, timestamp: ts, signature: sig, secret: "test-secret" }), true);
  assert.equal(verifySlackSignature({ rawBody: raw + " ", timestamp: ts, signature: sig, secret: "test-secret" }), false);
  const old = sign(raw, Math.floor(Date.now() / 1000) - 600);
  assert.equal(verifySlackSignature({ rawBody: raw, timestamp: old.ts, signature: old.sig, secret: "test-secret" }), false);
  assert.equal(verifySlackSignature({ rawBody: raw, timestamp: ts, signature: undefined, secret: "test-secret" }), false);
});

const cb = (event, extra = {}) => ({ type: "event_callback", team_id: "T1", event_id: "Ev1", event, ...extra });

test("classify: mention in channel replies in thread keyed by thread root", () => {
  const r = classifyEvent(cb({ type: "app_mention", channel: "C1", ts: "100.1", user: "U1", text: `<@${BOT}> hello` }), BOT);
  assert.equal(r.kind, "mention");
  assert.equal(r.text, "hello");
  assert.equal(r.replyThreadTs, "100.1");
  assert.equal(r.convKey, "T1:C1:100.1");
  const inThread = classifyEvent(cb({ type: "app_mention", channel: "C1", ts: "105.1", thread_ts: "100.1", user: "U1", text: `<@${BOT}> more` }), BOT);
  assert.equal(inThread.convKey, "T1:C1:100.1");
});

test("classify: DM top level vs DM thread", () => {
  const top = classifyEvent(cb({ type: "message", channel_type: "im", channel: "D1", ts: "1.1", user: "U1", text: "hi" }), BOT);
  assert.equal(top.convKey, "T1:D1:dm");
  assert.equal(top.replyThreadTs, null);
  const thr = classifyEvent(cb({ type: "message", channel_type: "im", channel: "D1", ts: "2.1", thread_ts: "1.1", user: "U1", text: "hi" }), BOT);
  assert.equal(thr.convKey, "T1:D1:1.1");
});

test("classify: ignores bots, own messages, edits, empty text, non-thread channel chatter", () => {
  const ev = (e) => classifyEvent(cb({ channel: "C1", ts: "1.1", user: "U1", text: "x", ...e }), BOT);
  assert.equal(ev({ type: "message", channel_type: "im", bot_id: "B1" }), null);
  assert.equal(ev({ type: "message", channel_type: "im", user: BOT }), null);
  assert.equal(ev({ type: "message", channel_type: "im", subtype: "message_changed" }), null);
  assert.equal(ev({ type: "app_mention", text: `<@${BOT}>` }), null);
  assert.equal(ev({ type: "message", channel_type: "channel" }), null);
  assert.equal(ev({ type: "message", channel_type: "channel", thread_ts: "0.5", text: `<@${BOT}> hi` }), null);
  assert.equal(ev({ type: "message", channel_type: "channel", thread_ts: "0.5" }).kind, "thread");
});

test("cleanText: unwraps slack links and entities", () => {
  assert.equal(cleanText("<@UBOT> see <https://a.jp|site> &amp; <https://b.jp>", BOT), "see site (https://a.jp) & https://b.jp");
});

test("mrkdwn: bold, headings, links, bullets, tables, code untouched", () => {
  const md = "## 人口\n**2,347人** と *推計*\n- [出典](https://x.jp)\n| a | b |\n|---|---|\n| 1 | 2 |\n```\n**raw**\n```";
  const out = toSlackMrkdwn(md);
  assert.match(out, /^\*人口\*/);
  assert.match(out, /\*2,347人\* と _推計_/);
  assert.match(out, /• <https:\/\/x\.jp\|出典>/);
  assert.match(out, /```\n\| a \| b \|\n\| 1 \| 2 \|\n```/);
  assert.match(out, /```\n\*\*raw\*\*\n```/);
  assert.equal(toSlackMrkdwn("a < b & c"), "a &lt; b &amp; c");
});

test("chunkText: splits long answers, keeps code fences balanced", () => {
  const long = Array.from({ length: 400 }, (_, i) => `line ${i} ` + "x".repeat(30)).join("\n");
  const chunks = chunkText("```\n" + long + "\n```", 3500);
  assert.ok(chunks.length > 2);
  for (const c of chunks) {
    assert.ok(c.length <= 3500, `chunk too long: ${c.length}`);
    assert.equal((c.match(/```/g) || []).length % 2, 0);
  }
  const huge = chunkText("y".repeat(9000), 3500);
  assert.equal(huge.join("").length, 9000);
});

// ---------------- 結合テスト(偽の外部サービス) ----------------

const fake = {};
function resetFake() {
  fake.conversations = new Map();
  fake.messages = [];
  fake.events = new Map();
  fake.slackCalls = [];
  fake.geminiCalls = [];
  fake.geminiDelayMs = 0;
  fake.geminiFailNext = 0;
  fake.geminiFailStatus = 500;
  fake.geminiAlwaysTool = false;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

before(() => {
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    const method = init.method || "GET";

    if (u.hostname === "slack.com") {
      const m = u.pathname.replace("/api/", "");
      fake.slackCalls.push({ method: m, ...body });
      return json({ ok: true, ts: `9${fake.slackCalls.length}.0`, user_id: BOT });
    }

    if (u.hostname === "generativelanguage.googleapis.com") {
      fake.geminiCalls.push(body);
      if (fake.geminiDelayMs) await new Promise((r) => setTimeout(r, fake.geminiDelayMs));
      if (fake.geminiFailNext > 0) {
        fake.geminiFailNext--;
        const msg = fake.geminiFailStatus === 429 ? "You exceeded your current quota (RESOURCE_EXHAUSTED)" : "internal";
        return json({ error: { message: msg } }, fake.geminiFailStatus);
      }
      if (fake.geminiAlwaysTool && body.tools)
        return json({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "amasas_query", args: { query: "select 1 from population" } } }] } }] });
      const last = body.contents[body.contents.length - 1];
      if (last.parts[0].functionResponse)
        return json({ candidates: [{ content: { role: "model", parts: [{ text: "住民基本台帳によると人口は2,347人です。" }] } }] });
      const text = last.parts[0].text;
      if (/海士町の人口/.test(text) && body.tools)
        return json({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "amasas_query", args: { query: "select * from amasas.v_town_overview" } } }] } }] });
      const seen = body.contents.filter((c) => c.role === "user" && c.parts[0].text).map((c) => c.parts[0].text);
      return json({ candidates: [{ content: { role: "model", parts: [{ text: `ANSWER to "${text}" | context: ${seen.join(" / ")}` }] } }] });
    }

    // Supabase REST
    const path = u.pathname.replace("/rest/v1/", "");
    const eq = (k) => (u.searchParams.get(k) || "").replace(/^eq\./, "");
    if (path === "rpc/amasas_maintenance_status") return json({ enabled: false });
    if (path === "rpc/amasas_query") return json([{ table_name: "v_town_overview", name_ja: "概観", cols: "a" }]);
    if (path === "rpc/slack_claim_event") {
      if (fake.events.has(body.p_event_key)) return json(false);
      fake.events.set(body.p_event_key, { status: "processing" });
      return json(true);
    }
    if (path === "rpc/slack_acquire_turn") {
      const c = fake.conversations.get(body.p_key) || { key: body.p_key };
      fake.conversations.set(body.p_key, c);
      if (c.lock && c.lock !== body.p_owner) return json("busy_conversation");
      c.lock = body.p_owner;
      return json("ok");
    }
    if (path === "rpc/slack_release_turn") {
      const c = fake.conversations.get(body.p_key);
      if (c && c.lock === body.p_owner) c.lock = null;
      return new Response(null, { status: 204 });
    }
    if (path === "slack_conversations") return json(fake.conversations.has(eq("key")) ? [{ key: eq("key") }] : []);
    if (path === "slack_events" && method === "PATCH") {
      Object.assign(fake.events.get(eq("event_key")), body);
      return new Response(null, { status: 204 });
    }
    if (path === "slack_messages" && method === "GET") {
      const rows = fake.messages.filter((m) => m.conversation_key === eq("conversation_key")).reverse();
      return json(rows.slice(0, Number(u.searchParams.get("limit"))));
    }
    if (path === "slack_messages" && method === "POST") {
      // 本物のPostgRESTと同じく、一括insertで行ごとにキーが違えば400(PGRST102)
      const keys = body.map((r) => Object.keys(r).sort().join(","));
      if (new Set(keys).size > 1) return json({ code: "PGRST102", message: "All object keys must match" }, 400);
      fake.messages.push(...body);
      return new Response(null, { status: 201 });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  };
});
beforeEach(resetFake);

// エラーログが出たテストは失敗にする(想定済みのものだけ許可)
const realLog = console.log;
let unexpectedErrors = [];
beforeEach(() => {
  unexpectedErrors = [];
  console.log = (line) => {
    if (/"level":"error"/.test(line) && !/"msg":"turn failed"/.test(line)) unexpectedErrors.push(line);
    else if (process.env.TEST_VERBOSE) realLog(line);
  };
});
afterEach(() => {
  console.log = realLog;
  assert.deepEqual(unexpectedErrors, []);
});

async function send(event, { eventId = "Ev" + Math.random(), retry } = {}) {
  const raw = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: eventId, authorizations: [{ user_id: BOT, is_bot: true }], event });
  const { ts, sig } = sign(raw);
  const headers = { "x-slack-request-timestamp": ts, "x-slack-signature": sig };
  if (retry) headers["x-slack-retry-num"] = String(retry);
  const t0 = Date.now();
  const res = await POST(new Request("https://x/api/slack/events", { method: "POST", body: raw, headers }));
  return { res, ackMs: Date.now() - t0 };
}
const settle = async (pred, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("timed out waiting for condition");
};
const done = (n) => () => [...fake.events.values()].filter((e) => e.status !== "processing").length >= n;
const finalTexts = () => fake.slackCalls.filter((c) => c.method === "chat.update").map((c) => c.text);

test("e2e: url_verification and bad signature", async () => {
  const raw = JSON.stringify({ type: "url_verification", challenge: "abc" });
  const { ts, sig } = sign(raw);
  const ok = await POST(new Request("https://x", { method: "POST", body: raw, headers: { "x-slack-request-timestamp": ts, "x-slack-signature": sig } }));
  assert.deepEqual(await ok.json(), { challenge: "abc" });
  const bad = await POST(new Request("https://x", { method: "POST", body: raw, headers: { "x-slack-request-timestamp": ts, "x-slack-signature": "v0=00" } }));
  assert.equal(bad.status, 401);
});

test("e2e: DM gets a general answer, acked before AI work finishes", async () => {
  fake.geminiDelayMs = 200;
  const { res, ackMs } = await send({ type: "message", channel_type: "im", channel: "D1", ts: "1.1", user: "U1", text: "What is a haiku?" });
  assert.equal(res.status, 200);
  assert.ok(ackMs < 150, `ack took ${ackMs}ms`);
  await settle(done(1));
  const posts = fake.slackCalls.filter((c) => c.method === "chat.postMessage");
  assert.equal(posts[0].thread_ts, undefined, "DM top-level reply");
  assert.match(finalTexts().at(-1), /ANSWER to "What is a haiku\?"/);
  assert.equal(fake.messages.length, 2);
  // Slack用の汎用指示がシステムプロンプトの先頭に入っている
  assert.match(fake.geminiCalls[0].system_instruction.parts[0].text, /^あなたはSlack上で働く汎用アシスタント/);
});

test("e2e: channel mention replies in thread; Ama Town question is grounded via amasas_query", async () => {
  await send({ type: "app_mention", channel: "C1", ts: "200.1", user: "U1", text: `<@${BOT}> 海士町の人口は?` });
  await settle(done(1));
  const post = fake.slackCalls.find((c) => c.method === "chat.postMessage");
  assert.equal(post.thread_ts, "200.1");
  assert.match(finalTexts().at(-1), /住民基本台帳によると/);
  assert.equal(fake.messages[1].sql_log.length, 1);
});

test("e2e: retried and double-delivered events produce one reply", async () => {
  const ev = { type: "app_mention", channel: "C1", ts: "300.1", user: "U1", text: `<@${BOT}> hi` };
  await Promise.all([
    send(ev, { eventId: "EvA" }),
    send(ev, { eventId: "EvA", retry: 1 }),
    send({ ...ev, type: "message", channel_type: "channel", thread_ts: "300.1", ts: "300.1" }, { eventId: "EvB" }),
  ]);
  await settle(done(1));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fake.slackCalls.filter((c) => c.method === "chat.postMessage").length, 1);
  assert.equal(fake.geminiCalls.length, 1);
});

test("e2e: thread follow-up keeps context; separate threads and DMs do not leak", async () => {
  await send({ type: "app_mention", channel: "C1", ts: "400.1", user: "U1", text: `<@${BOT}> my name is Ken` });
  await settle(done(1));
  // 無関係なスレッドでのメンションなし発言は無視される
  await send({ type: "message", channel_type: "channel", channel: "C1", ts: "500.2", thread_ts: "500.1", user: "U1", text: "ignored" });
  // ボットの会話スレッドでの続き(メンションなし)には答える
  await send({ type: "message", channel_type: "channel", channel: "C1", ts: "400.2", thread_ts: "400.1", user: "U1", text: "what is my name?" });
  await settle(done(2));
  assert.match(finalTexts().at(-1), /context: my name is Ken \/ what is my name\?/);
  // 別スレッド・DMには前の文脈が入らない
  await send({ type: "app_mention", channel: "C1", ts: "600.1", user: "U2", text: `<@${BOT}> who am I?` });
  await send({ type: "message", channel_type: "im", channel: "D9", ts: "601.1", user: "U1", text: "and here?" });
  await settle(done(4));
  const texts = finalTexts();
  assert.ok(texts.some((t) => /context: who am I\?$/.test(t)));
  assert.ok(texts.some((t) => /context: and here\?$/.test(t)));
  assert.ok(!fake.geminiCalls.some((c) => JSON.stringify(c.contents).includes("ignored")));
});

test("e2e: AI failure gives a clear message, releases the lock, next turn works", async () => {
  fake.geminiFailNext = 1;
  await send({ type: "message", channel_type: "im", channel: "D2", ts: "700.1", user: "U1", text: "first" });
  await settle(done(1));
  assert.match(finalTexts().at(-1), /エラーが発生しました/);
  assert.equal(fake.messages.length, 0, "failed turn not written to history");
  assert.equal(fake.conversations.get("T1:D2:dm").lock, null);
  await send({ type: "message", channel_type: "im", channel: "D2", ts: "700.2", user: "U1", text: "second" });
  await settle(done(2));
  assert.match(finalTexts().at(-1), /ANSWER to "second" \| context: second$/);
});

test("e2e: overlapping turns in one conversation are serialized", async () => {
  fake.geminiDelayMs = 300;
  await Promise.all([
    send({ type: "message", channel_type: "im", channel: "D3", ts: "800.1", user: "U1", text: "one" }),
    send({ type: "message", channel_type: "im", channel: "D3", ts: "800.2", user: "U1", text: "two" }),
  ]);
  await settle(done(2), 8000);
  const roles = fake.messages.map((m) => m.role).join(",");
  assert.equal(roles, "user,assistant,user,assistant");
  // 2つ目のターンは1つ目の回答を履歴に含んでいる
  assert.equal(fake.geminiCalls[1].contents.length, 3);
});

test("never times out: past the wrap-up point it stops querying and still answers from data so far", async () => {
  fake.geminiAlwaysTool = true;
  const { answer, sqlLog } = await runAgent({
    model: "m", layer: "amasas", sysText: "s",
    contents: [{ role: "user", parts: [{ text: "海士町の人口は?" }] }],
    wrapUpAt: Date.now() - 1,
  });
  assert.equal(sqlLog.length, 1, "one query round, then wrap-up");
  assert.match(answer, /^ANSWER to/, "an answer, not an error or timeout");
  const last = fake.geminiCalls.at(-1);
  assert.equal(last.tools, undefined, "wrap-up call has no tools");
  assert.match(JSON.stringify(last.contents), /時間の都合でデータの照会はここまでです/);
});

test("e2e: AI rate limit is retried and still answered (no error posted)", async () => {
  fake.geminiFailStatus = 429;
  fake.geminiFailNext = 4; // callGemini内の再試行+代替モデルも尽きる → Slack側で待って再試行
  await send({ type: "message", channel_type: "im", channel: "D5", ts: "900.1", user: "U1", text: "hello" });
  await settle(done(1), 20000);
  assert.match(finalTexts().at(-1), /ANSWER to "hello"/);
  assert.equal([...fake.events.values()][0].status, "done");
});

test("e2e: exhausted credits/quota gives a clear quota message", async () => {
  fake.geminiFailStatus = 429;
  fake.geminiFailNext = 100;
  await send({ type: "message", channel_type: "im", channel: "D6", ts: "901.1", user: "U1", text: "hello" });
  await settle(done(1), 30000);
  assert.match(finalTexts().at(-1), /クレジットが不足/);
  assert.equal(fake.conversations.get("T1:D6:dm").lock, null);
});
