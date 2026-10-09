// Slack版AMASASの純粋ヘルパー(署名検証・イベント振り分け・mrkdwn変換・分割・プロンプト)。
// I/Oを持たないのでnode:testで単体テストできる(test/slack.test.js)。
import { createHmac, timingSafeEqual } from "node:crypto";
import { buildSystemPrompt } from "./amasas-agent.js";

// Slackの署名検証(v0)。5分より古いリクエストはリプレイとして拒否
export function verifySlackSignature({ rawBody, timestamp, signature, secret, nowSec = Math.floor(Date.now() / 1000) }) {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 60 * 5) return false;
  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

// 受け取ったイベントを「返信すべき依頼」に変換する。対象外ならnull。
//   mention: チャンネルでのメンション → そのスレッドに返信
//   dm:      ボットとのDM → DMのトップレベル(DM内スレッドならそのスレッド)に返信
//   thread:  ボットが参加している会話スレッドでの続き(メンションなし) → 呼び出し側で会話の実在を確認
// ボット自身・他のボット・編集/削除などのsubtypeはすべて無視(ボット同士のループ防止)
export function classifyEvent(body, botUserId) {
  if (!body || body.type !== "event_callback") return null;
  const e = body.event || {};
  const team = body.team_id || e.team;
  if (!team || !e.channel || !e.ts) return null;
  if (e.bot_id || e.subtype || e.bot_profile) return null;
  if (!e.user || (botUserId && e.user === botUserId)) return null;

  const text = cleanText(e.text, botUserId);
  if (!text) return null;

  const base = { team, channel: e.channel, ts: e.ts, user: e.user, text, eventId: body.event_id || null };
  base.eventKey = `${team}:${e.channel}:${e.ts}`;

  if (e.type === "app_mention") {
    const root = e.thread_ts || e.ts;
    return { ...base, kind: "mention", isDm: false, threadTs: root, replyThreadTs: root, convKey: `${team}:${e.channel}:${root}` };
  }

  if (e.type === "message" && e.channel_type === "im") {
    if (e.thread_ts && e.thread_ts !== e.ts)
      return { ...base, kind: "dm", isDm: true, threadTs: e.thread_ts, replyThreadTs: e.thread_ts, convKey: `${team}:${e.channel}:${e.thread_ts}` };
    return { ...base, kind: "dm", isDm: true, threadTs: null, replyThreadTs: null, convKey: `${team}:${e.channel}:dm` };
  }

  if (e.type === "message" && ["channel", "group", "mpim"].includes(e.channel_type)) {
    // スレッド返信のみ。メンション付きはapp_mention側で処理される(同じtsなので重複排除もされる)
    if (!e.thread_ts || e.thread_ts === e.ts) return null;
    if (botUserId && String(e.text || "").includes(`<@${botUserId}>`)) return null;
    return { ...base, kind: "thread", isDm: false, threadTs: e.thread_ts, replyThreadTs: e.thread_ts, convKey: `${team}:${e.channel}:${e.thread_ts}` };
  }

  return null;
}

// ボットへのメンションを取り除き、Slackのリンク表記を読める形に戻す
export function cleanText(text, botUserId) {
  let s = String(text || "");
  if (botUserId) s = s.split(`<@${botUserId}>`).join("");
  s = s
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return s.trim();
}

// Geminiの回答(Markdown)をSlackのmrkdwnに変換。コードブロック内は触らない
export function toSlackMrkdwn(md) {
  const out = [];
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let inCode = false;
  let table = [];
  const flushTable = () => {
    if (!table.length) return;
    // 区切り行(|---|---|)を除いて等幅表示。Slackは表を描画できないため
    out.push("```", ...table.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)), "```");
    table = [];
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushTable();
      inCode = !inCode;
      out.push(line.trim());
      continue;
    }
    if (inCode) { out.push(line); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { table.push(line.trim()); continue; }
    flushTable();
    out.push(inlineMrkdwn(line));
  }
  flushTable();
  if (inCode) out.push("```");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inlineMrkdwn(line) {
  let s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const codes = [];
  s = s.replace(/`[^`]+`/g, (m) => { codes.push(m); return `\u0000${codes.length - 1}\u0000`; });
  const heading = s.match(/^\s*#{1,6}\s+(.*)$/);
  if (heading) s = `\u0001${heading[1].replace(/\*\*/g, "")}\u0001`;
  s = s
    .replace(/^(\s*)[-*+]\s+/, "$1• ")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, t, u) => `<${u}|${t || u}>`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<${u}|${t}>`)
    .replace(/\*\*(.+?)\*\*/g, "\u0001$1\u0001")
    .replace(/__(.+?)__/g, "\u0001$1\u0001")
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])/g, "$1_$2_")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/\u0001/g, "*");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

// 長い回答をSlackのメッセージ単位に分割。コードブロックをまたぐ場合は閉じて開き直す
export function chunkText(text, max = 3500) {
  const chunks = [];
  let cur = "";
  let inCode = false;
  const push = () => {
    if (!cur.trim()) { cur = ""; return; }
    chunks.push(inCode ? cur + "\n```" : cur);
    cur = inCode ? "```\n" : "";
  };
  for (let line of String(text || "").split("\n")) {
    while (line.length > max - 10) {
      if (cur) push();
      cur += line.slice(0, max - 10);
      line = line.slice(max - 10);
      push();
    }
    if ((cur + "\n" + line).length > max - 4) push();
    cur += (cur && !cur.endsWith("\n") ? "\n" : "") + line;
    if (/^\s*```/.test(line)) inCode = !inCode;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [""];
}

// Slack版の指示: 一般的な質問には自分の知識で直接答え、海士町・AMASASの話題のときだけ
// Web版と同じAMASAS窓口の指示(データの規律・出典)に従ってデータを照会する
const SLACK_PROMPT_PREFIX = `あなたはSlack上で働く汎用アシスタント「Amasa AI」です。海士町(島根県隠岐郡)のオープンデータ基盤AMASASに接続されています。

## Slackでの基本方針(以下の「AMASAS窓口の指示」より優先する)
- どんな質問にも直接答える。仕事・技術・文章作成・翻訳・要約・計算・一般知識などの質問には、あなた自身の知識でそのまま答える。「データを調べましょうか?」などの確認や聞き返しを挟まない。本当に答えようがないほど曖昧なときだけ短く確認する
- 海士町・AMASAS・地域の統計に関わる質問のときだけ amasas_query でデータを照会し、下の「AMASAS窓口の指示」(データの規律・出典の付け方)に必ず従う。一般的な質問ではデータを照会しない
- 相手が使った言語で答える(英語の質問には英語で)
- あなたはWeb検索など最新情報を取得する手段を持っていない。ニュース・株価・為替・天気・今日の出来事など最新情報が必要な質問には、その情報は確認できないことを最初に明示し、知識の時点の情報であることを断ったうえで分かる範囲だけ答える。最新情報を知っているかのように答えない
- 分からないこと・データにないことは推測で埋めず正直に言う
- Slackで読みやすく簡潔に。見出しは太字1行、箇条書きは短く。表は必要なときだけ
- スレッドに複数人がいる場合は、最後の発言に答える

## AMASAS窓口の指示(海士町・AMASASのデータに関する質問に適用)
`;

export async function buildSlackSystemPrompt(layer) {
  return SLACK_PROMPT_PREFIX + (await buildSystemPrompt(layer));
}
