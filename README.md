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

## 管理画面（Admin）

`/admin/` 以下に、会話ログ・フィードバック・ナレッジベース（l4層に注入される町の公式コンテンツ）・管理者アカウントを扱う管理画面があります。外部npm依存・ビルドステップなしという本体と同じ方針で、Supabase Auth + PostgRESTへの直接fetchのみで作られています（`@supabase/supabase-js`不使用）。

- `admin/login.html` — Supabase Authでサインイン
- `admin/index.html` — ダッシュボード（実データのKPI + システム状態）
- `admin/conversations.html` — セッション/メッセージの閲覧
- `admin/feedback.html` — 👍/👎フィードバックの一覧
- `admin/knowledge.html` — knowledge.\*（8テーブル）の編集
- `admin/users.html` — 管理者アカウントとロール（owner/admin/editor/viewer）
- `admin/settings.html` — メンテナンスモードの切替 + 実行時構成の診断表示
- `admin/audit.html` — 監査ログ（knowledge編集・管理者ロール変更を自動記録）

権限はDB側（RLSポリシー + `admin.*`関数内のロールチェック）で強制されます。UI側の非表示はあくまで補助であり、実際の境界は`supabase/migrations/0006_admin.sql`のSQLです。

### マイグレーションの自動適用（GitHub Actions）

`.github/workflows/supabase-migrations-deploy.yml`が、`supabase/migrations/`配下の変更を含むpushが`main`にあると、自動で`supabase db push`を実行します（`.github/workflows/supabase-migrations-check.yml`はPR時に`--dry-run`で先に確認するチェック用）。以降は新しいマイグレーションファイルを追加してmainにマージするだけで、`psql`を手動で叩く必要はありません。

有効にするには、GitHubリポジトリの **Settings → Secrets and variables → Actions** に以下2つを登録してください（値は貼り付けないでください。私からは入力できません — 各自で登録してください）:

- `SUPABASE_ACCESS_TOKEN` — https://supabase.com/dashboard/account/tokens で発行する個人アクセストークン
- `SUPABASE_DB_PASSWORD` — Amasasプロジェクトの接続文字列に使うDBパスワード（Project Settings → Database → Connection stringから確認、忘れた場合は同画面でリセット可能）

2026-09-02時点で、`0001`〜`0006`は既に本番へ適用済みで、リモート側のマイグレーション履歴テーブルも`supabase migration repair`で整合済みです（このワークフローが初回実行時に過去分を再適用しようとすることはありません）。

### 本番デプロイの自動化（GitHub Actions → Vercel）

`.github/workflows/vercel-deploy.yml`が、`main`へのpushで`amasas-ai`プロジェクト（本番ドメイン`amasas-chat-demo-7bk6.vercel.app`を提供している実体 — Vercel上のプロジェクト名はドメイン名やリポジトリ名とは一致しないので注意）の本番デプロイを実行します（`vercel build` + `vercel deploy --prod`）。このリポジトリからは他に`amasas-chat-demo`・`amasas-chat-demo-main`の2プロジェクトもデプロイされていますが、この2つは対象外で、これまで通りVercelのGit連携が直接デプロイします。プレビューデプロイ（PR・ブランチpush）はどのプロジェクトも変わらずVercel側が自動で行います。

有効にするには、GitHubリポジトリの **Settings → Secrets and variables → Actions** に以下3つを登録してください（値は貼り付けないでください。私からは入力できません — 各自で登録してください）:

- `VERCEL_TOKEN` — https://vercel.com/account/tokens で発行する個人アクセストークン
- `VERCEL_ORG_ID` — Vercelチームの設定ページ（Settings → General）に表示される Team ID
- `VERCEL_PROJECT_ID` — **`amasas-ai`**プロジェクト（`amasas-chat-demo`ではない）の Settings → General に表示される Project ID

**あわせて必須の手動設定**: `amasas-ai`プロジェクトの Settings → Git → **Ignore Build Step** に以下を設定し、Vercel自身による`main`ブランチの自動ビルド/本番デプロイを止めてください（これをやらないと、このワークフローとVercelの両方が同じpushで本番デプロイを行うことになります）。他ブランチ（PRプレビュー）はこれまで通りビルドされます:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 0; else exit 1; fi
```

### セットアップ（初回のみ・手動）

1. `0006_admin.sql`を他のマイグレーションと同じ手順で適用します（上記「DBについて」参照。新規マイグレーションは上記のGitHub Actionsで自動適用されるため、これは初回のみの手順です）:
   ```bash
   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_admin.sql
   ```
2. 最初の管理者（owner）を作成します。Supabaseダッシュボード → Authentication → Users → Add userでユーザーを作成するか、`POST /auth/v1/admin/users`を叩きます。
3. 作成したユーザーのUUIDを控え、`admin.admin_users`にowner権限で登録します:
   ```sql
   insert into admin.admin_users (id, email, display_name, role)
   values ('<auth.usersのUUID>', '<メールアドレス>', '<表示名（任意）>', 'owner');
   ```
4. 新しい環境変数は不要です。`api/admin/invite.js`は既存の`SUPABASE_SERVICE_KEY`を使うので、招待機能を使う場合はこれがVercelに設定されている必要があります（フィードバック記録に既に必要なものと同じ）。
5. デプロイ後、`/admin/login.html`からowner用アカウントでサインインします。以降の管理者は`admin/users.html`から招待できます（Supabase Authの招待メールを使用。届かない場合はダッシュボードから直接ユーザー作成してください）。

### メール（招待・パスワード再設定）

Supabaseの既定メール送信は送信数が厳しく制限されているため（`email rate limit`エラー）、実運用では独自SMTP（例: HostingerのSMTP）の設定を推奨します: Supabaseダッシュボード → Authentication → Emails → SMTP Settings。

あわせて、招待・パスワード再設定リンクの送信先を固定するため、Authentication → URL Configuration → **Redirect URLs**に以下を追加してください（このリポジトリは複数のVercelプロジェクトにデプロイされているため、ワイルドカードが必要です）:

```
https://*.vercel.app/admin/login.html
```

メールの見た目は`supabase/email-templates/`にAMASASのブランドに合わせたHTMLテンプレートを用意しています。Supabaseダッシュボード → Authentication → Emails → Templatesで、該当するテンプレート（Invite user / Reset Password）にそれぞれの内容を貼り付けてください（`{{ .ConfirmationURL }}`はSupabase側で自動置換されます）。

### 手動QAチェックリスト

- [ ] ownerでログイン → ダッシュボードに実データ（0件なら空状態）が表示される
- [ ] 未ログインで`/admin/index.html`等に直接アクセス → `login.html`にリダイレクトされる
- [ ] `admin/users.html`から新規管理者を招待 → メール受信 → パスワード設定 → ログインできる
- [ ] editorロールでログイン → ナレッジは編集できるが「管理者」「設定」「監査ログ」タブが出ない
- [ ] viewerロールでログイン → ナレッジ編集ボタンが出ない（RPC直呼びでも`forbidden`で拒否される）
- [ ] ナレッジベースで1件編集・1件追加・1件削除 → `admin/audit.html`に記録される
- [ ] `admin/settings.html`でメンテナンスモードをON → 公開チャット（`/`）にメッセージを送るとメンテナンス表示になる → OFFに戻す
- [ ] `admin/feedback.html`の👎から「会話を見る」→ 該当セッションのスレッドが開く

## セキュリティ

- DBへのアクセスは読み取り専用RPC（SELECT以外拒否・5秒・500行上限・RLS）
- 合言葉は廃止。`/api/chat`は誰でも呼べるため、必要になったらVercel側でレート制限やBot対策をかけてください
