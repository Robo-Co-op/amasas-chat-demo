// 入口の準備。合言葉の入力欄は廃止したため、2つの使い方がある。
//   1) x-passcodeヘッダー無し … デモ用の合言葉を払い出す(画面の初期化用)
//   2) x-passcodeヘッダー有り … 従来どおり正誤を検証する(既存クライアント互換)
// どちらもPreview環境か否かと既定のモデル・データ層を返す(検証用プルダウンの表示判定に使う)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const preview = process.env.VERCEL_ENV !== "production";
  const defaults = {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    dataLayer: ["ai", "l4"].includes(process.env.DATA_LAYER) ? process.env.DATA_LAYER : "amasas",
  };

  // ヘッダーそのものが無い場合のみ払い出し。空文字("")は検証扱いにする
  const supplied = req.headers["x-passcode"];
  if (supplied === undefined) {
    // 払い出した合言葉はブラウザが /api/chat 等に付け直す。
    // 誰でも取得できるので、これは総当たり防止ではなく素の叩きを減らすためのもの
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, passcode: process.env.APP_PASSCODE || "", preview, defaults });
  }

  const ok = supplied === process.env.APP_PASSCODE;
  if (!ok) return res.status(200).json({ ok });
  return res.status(200).json({ ok, preview, defaults });
}
