// 合言葉は廃止した。この口が返すのは画面の初期設定だけ。
// Preview環境か否かと既定のモデル・データ層(検証用プルダウンの表示判定に使う)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  return res.status(200).json({
    ok: true,
    preview: process.env.VERCEL_ENV !== "production",
    defaults: {
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      dataLayer: ["ai", "l4"].includes(process.env.DATA_LAYER) ? process.env.DATA_LAYER : "amasas",
    },
  });
}
