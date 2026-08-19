// 合言葉の検証(入口ゲート用)。正誤とも200で即答する
// 認証OK時はPreview環境か否かと既定のモデル・データ層も返す(検証用プルダウンの表示判定に使う)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const ok = (req.headers["x-passcode"] || "") === process.env.APP_PASSCODE;
  if (!ok) return res.status(200).json({ ok });
  const preview = process.env.VERCEL_ENV !== "production";
  const defaults = {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    dataLayer: ["ai", "l4"].includes(process.env.DATA_LAYER) ? process.env.DATA_LAYER : "amasas",
  };
  return res.status(200).json({ ok, preview, defaults });
}
