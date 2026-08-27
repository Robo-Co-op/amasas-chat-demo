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

また、DBを新プロジェクト`jcokpgmqmtxefzjjenrx`（このリポジトリ側でアクセス可能）に移行し、リポジトリだけで再現できる状態にしました（[Issue #4](https://github.com/Robo-Co-op/amasas-chat-demo/issues/4)）。`api/chat.js`・`api/feedback.js`の接続先を新プロジェクトに統一し、旧DBに手動作成されていた読み取り専用RPC（`amasas_query`/`ai_query`）とデータ層（`amasas`/`ai`/`knowledge`：50テーブル・14ビュー・15,349行）を`supabase/migrations/`に取り込みました。**残作業**は、これらのマイグレーションを新プロジェクトに流し込み（下記「DBについて」）、`GEMINI_API_KEY`をVercelに設定するだけです。

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

DB(Supabase)への接続情報はコード内に組み込まれており、現在は新プロジェクト`jcokpgmqmtxefzjjenrx`を指します。ただし新プロジェクトは空のため、チャットを動かすには下記「DBについて」の移行作業（RPCとデータ層の取り込み）が必要です。

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

コードが読み書きするSupabaseは新プロジェクト`jcokpgmqmtxefzjjenrx`（このリポジトリ側で管理・アクセス可能）に統一済みです。`api/chat.js`・`api/feedback.js`の接続先とキーはこのプロジェクトを指します。

DBの中身は`supabase/migrations/`に全て取り込み済みで、リポジトリだけで新しいSupabaseに再現できます:

- `0001_chat_logging.sql` — 会話ログ（`amasas_chat_sessions` / `amasas_chat_messages` / `amasas_chat_feedback`。コードの書き込みと一致）
- `0002_read_only_rpc.sql` — 読み取り専用RPC `amasas_query` / `ai_query`（旧DBから抽出した本物の定義。SECURITY INVOKERで、`anon`ロールの権限が実際の境界）
- `0003_amasas_schema.sql` — 3スキーマ・50テーブル・14ビュー・RLS・42ポリシー・grant
- `0004_amasas_seed.sql` — データ本体 15,349行（`jsonb_populate_recordset`で型安全に投入）＋外部キー

### 新プロジェクトへの流し込み

`0004`が7MBあり、SQL EditorよりCLI/`psql`が確実です。新プロジェクトの接続文字列（Settings → Database → Connection string）を使い、番号順に適用してください:

```bash
DB_URL="postgresql://postgres:[パスワード]@db.jcokpgmqmtxefzjjenrx.supabase.co:5432/postgres"
for f in supabase/migrations/000*.sql; do
  echo "== $f =="; psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

投入後、Vercelの`SUPABASE_SERVICE_KEY`を新プロジェクトのservice_roleキーに設定すれば会話ログの記録も動きます。

> 旧DB`ugddjjnldavwrhfwtxwa`のservice_roleキーは移行作業で一時的に使用しました。**露出したので再生成（revoke）してください。** 通常運用では不要です（読み取りは公開anonキー経由）。

## セキュリティ

- DBへのアクセスは読み取り専用RPC（SELECT以外拒否・5秒・500行上限・RLS）
- 合言葉は廃止。`/api/chat`は誰でも呼べるため、必要になったらVercel側でレート制限やBot対策をかけてください
