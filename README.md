# AMASAS Chat Demo

海士町のオープンデータにチャットで話しかけられるアプリです。ランディングページから、合言葉なしでそのまま試せます。

## 引き継ぎ状況（2026-08-26）

**本番URLで今すぐ試せる状態ではありません。** 未解決分はGitHub Issuesに登録済みです。

1. **本番のVercelプロジェクトが2つに分かれている。**（[Issue #2](https://github.com/Robo-Co-op/amasas-chat-demo/issues/2)）
   `https://amasas-chat-demo.vercel.app`（Robo Co-op teamアカウント、このGitHubリポジトリと連携済み・pushで自動デプロイされる）と、
   `https://amasas-chat-demo-main.vercel.app`（個人アカウント`dimdimlians-projects`、手動デプロイで固定・GitHub連携なし）が別プロジェクトとして存在します。
   このリポジトリへの変更が反映されるのは前者だけです。どちらを本番にするか未確定です。
2. **`amasas-chat-demo`（Robo Co-op team側）に有効な`GEMINI_API_KEY`が設定されていない。**（[Issue #3](https://github.com/Robo-Co-op/amasas-chat-demo/issues/3)）
   個人アカウント側のプロジェクトには動くキーがある模様。チャットを実際に試せるのは今のところ個人アカウント側のURLだけです。

また、`supabase/migrations/0001_create_amasas_schema.sql`は「共有Robo Co-op Supabase（`rzuvdnishrxosjkopcyp`）へ移行する」という内容ですが、`api/chat.js`・`api/feedback.js`が実際に読み書きしているのは別プロジェクト（`ugddjjnldavwrhfwtxwa`、下記「DBについて」参照）です。マイグレーションのテーブル名（`amasas.chat_sessions`等）とコードが書き込む先（`amasas_chat_feedback`）も一致していません。移行は書かれただけで、コード側は追随していないと見られます。DBを触る前に必ず両方を見比べてください。（[Issue #4](https://github.com/Robo-Co-op/amasas-chat-demo/issues/4)）

## 構成

- `index.html` — ランディングページ + 入口画面 + チャットUI
- `api/chat.js` — Gemini(function calling) + Supabase読み取り専用RPCで回答を生成
- `api/feedback.js` — 回答への評価コメントを記録（`SUPABASE_SERVICE_KEY`未設定時はスキップ）
- `api/auth.js` — 画面の初期設定（Preview判定と既定モデル・データ層）を返すだけ

## セットアップ（Vercelにデプロイ）

1. https://vercel.com → Add New → Project → GitHubからこのリポジトリをimport
2. 環境変数を設定（Project Settings → Environment Variables）。**ProductionとPreview両方**に設定してください:
   - `GEMINI_API_KEY`: 自分のキー（https://aistudio.google.com/apikey で取得）
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite`
   - `DATA_LAYER`: `l4`
   - `SUPABASE_SERVICE_KEY`: 省略可（未設定でも会話ログの記録がスキップされるだけでチャット自体は動く）
3. importすると自動でデプロイされ、URLが発行されます
4. 以降は`main`ブランチへのpushで本番URLへ自動的に再デプロイされます。それ以外のブランチやPRはプレビューURLとして自動デプロイされます

DB(Supabase)への接続情報はコード内に組み込まれていますが、上記「引き継ぎ状況」のとおりコードとマイグレーションが指す先が一致していない疑いがあります。DBの準備が本当に不要かどうかは、触る前に要確認です。

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

## DBについて

現在コードが接続しているSupabaseプロジェクトと、`supabase/migrations/`が想定しているプロジェクトが異なります。

- **コードが実際に呼んでいる先**（`api/chat.js`・`api/feedback.js`に直接ハードコード）: `https://ugddjjnldavwrhfwtxwa.supabase.co`
  - `rpc/amasas_query`・`rpc/{その他RPC}`・テーブル`amasas_chat_feedback`
  - `amasas_query`はこのリポジトリのどこにも定義がありません。既存DB側に手動で作られたものと見られます
- **マイグレーションが想定している先**: 共有Robo Co-op Supabase（`rzuvdnishrxosjkopcyp`）
  - `amasas.chat_sessions` / `amasas.chat_messages` / `amasas.chat_feedback`（コードの`amasas_chat_feedback`とは名前が違う）
  - マイグレーションのコメントに「以前は別Supabaseプロジェクトにamasas_chat_sessions/messages/feedbackとして記録していた」とあり、統合を意図して書かれたが、コード側は追随していない

どちらを正とするか（統合を完了させる／マイグレーションを現状に合わせて書き直す）を決めてから着手してください。

## セキュリティ

- DBへのアクセスは読み取り専用RPC（SELECT以外拒否・5秒・500行上限・RLS）
- 合言葉は廃止。`/api/chat`は誰でも呼べるため、必要になったらVercel側でレート制限やBot対策をかけてください
