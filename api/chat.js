// 対話できるAMASAS: Gemini function calling + Supabase読み取り専用RPC (SSEストリーミング)
// プロンプト・Geminiループ本体はSlack版と共有するため lib/amasas-agent.js にある
import {
  DATA_LAYER,
  DEFAULT_MODEL,
  IS_PREVIEW,
  ALLOWED_MODELS,
  ALLOWED_LAYERS,
  buildSystemPrompt,
  runAgent,
  getMaintenanceStatus,
  logToDb,
} from "../lib/amasas-agent.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messages, sessionId, roleTag, nickname, visitorId, model: reqModel, dataLayer: reqLayer } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || !sessionId)
    return res.status(400).json({ error: "bad request" });

  const maintenance = await getMaintenanceStatus();
  if (maintenance && maintenance.enabled) {
    return res.status(503).json({
      error: maintenance.message || "ただいまメンテナンス中です。しばらくしてから再度お試しください。",
    });
  }

  // Preview環境のみ、ホワイトリスト内の値に限りリクエスト側の指定を採用(検証用)
  const model = IS_PREVIEW && ALLOWED_MODELS.includes(reqModel) ? reqModel : DEFAULT_MODEL;
  const layer = IS_PREVIEW && ALLOWED_LAYERS.includes(reqLayer) ? reqLayer : DATA_LAYER;

  // SSE開始
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const onStatus = (text) => send({ type: "status", text });
  const sysText = await buildSystemPrompt(layer);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let answer, sqlLog;
  try {
    ({ answer, sqlLog } = await runAgent({ model, layer, sysText, contents, onStatus }));
  } catch (e) {
    const friendly = /high demand|overloaded|429|503/i.test(String(e.message))
      ? "ただいまAIが混み合っています。1分ほど待ってからもう一度お試しください。"
      : "処理中にエラーが発生しました。もう一度お試しください。（詳細: " + String(e.message || e) + "）";
    send({ type: "error", text: friendly });
    return res.end();
  }

  // ログ記録(失敗しても回答は返す)
  let messageId = null;
  await logToDb("amasas_chat_sessions?on_conflict=id", [
    { id: sessionId, role_tag: roleTag || null, nickname: nickname || null, visitor_id: visitorId || null },
  ]);
  const turn = messages.length;
  // nickname/role_tagはamasas_chat_sessions側にもあるが、会話ログ単体を見て
  // 誰の発言か分かるよう、各メッセージ行にもそのまま複製して残す
  await logToDb("amasas_chat_messages", [
    {
      session_id: sessionId,
      turn: turn - 1,
      role: "user",
      content: messages[messages.length - 1].content,
      data_layer: layer,
      model,
      nickname: nickname || null,
      role_tag: roleTag || null,
    },
  ]);
  const saved = await logToDb("amasas_chat_messages", [
    {
      session_id: sessionId,
      turn,
      role: "assistant",
      content: answer,
      sql_log: sqlLog,
      data_layer: layer,
      model,
      nickname: nickname || null,
      role_tag: roleTag || null,
    },
  ]);
  if (saved && saved[0]) messageId = saved[0].id;

  send({ type: "done", answer, messageId, sqlCount: sqlLog.length, model, dataLayer: layer });
  res.end();
}
