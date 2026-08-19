# AMASAS Chat Demo

海士町のオープンデータにチャットで話しかけられるアプリです。合言葉を入力すると使えます。

## 構成

- `index.html` — チャットUI
- `api/chat.js` — Gemini(function calling) + Supabase読み取り専用RPCで回答を生成
- `api/feedback.js` — 回答への評価コメントを記録（`SUPABASE_SERVICE_KEY`未設定時はスキップ）
- `api/auth.js` — 合言葉の検証

## セットアップ（Vercelにデプロイ）

1. https://vercel.com → Add New → Project → GitHubからこのリポジトリをimport
2. 環境変数を設定（Project Settings → Environment Variables）。**ProductionとPreview両方**に設定してください:
   - `GEMINI_API_KEY`: 自分のキー（https://aistudio.google.com/apikey で取得）
   - `APP_PASSCODE`: 任意の値
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite`
   - `DATA_LAYER`: `l4`
   - `SUPABASE_SERVICE_KEY`: 省略可（未設定でも会話ログの記録がスキップされるだけでチャット自体は動く）
3. importすると自動でデプロイされ、URLが発行されます
4. 以降は`main`ブランチへのpushで本番URLへ自動的に再デプロイされます。それ以外のブランチやPRはプレビューURLとして自動デプロイされます

DB(Supabase)への接続情報はコード内に読み取り専用の設定で組み込まれているため、DB側の準備は不要です。

## 補足

`main`（本番）ではフィードバックの👍👎UIはVercelの自動判定で非表示になります。それ以外のブランチ（プレビュー）では表示されます。

## ローカルで試す（vercel dev、任意）

外部npm依存・ビルドステップなしの構成なので、Vercel公式のローカル開発コマンド`vercel dev`でも動作を確認できます。

1. Vercel CLIをインストール: `npm i -g vercel`
2. ログイン: `vercel login`
3. このディレクトリで`vercel link`
4. 環境変数を設定（Project Settings → Environment Variables → Development）: 上記と同じ変数
5. 起動: `vercel dev`（既定で http://localhost:3000 ）

`vercel dev`はローカルの`.env.local`を見ず、リンクしたVercelプロジェクトの「Development」環境変数をクラウドから直接読みます。`.env.example`は必要な変数の一覧としてのみ使ってください。

## セキュリティ

- DBへのアクセスは読み取り専用RPC（SELECT以外拒否・5秒・500行上限・RLS）
- 合言葉はAPI側で検証。外れるとGemini APIは呼ばれません
