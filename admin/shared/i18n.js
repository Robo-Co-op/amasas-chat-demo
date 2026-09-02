// AMASAS Admin — EN/JA dictionary + lookup helper. Self-contained (own
// localStorage access) so it has no load-order dependency on admin.js, even
// though admin.js itself calls into I18n for its own strings (NAV labels,
// shell chrome). Scoped to /admin/ only — the public chat app stays
// Japanese-only and doesn't load this file.
const I18n = (() => {
  const STORAGE_KEY = "amasas_admin_lang";

  const STRINGS = {
    // ---------------- common ----------------
    "common.save": { ja: "保存", en: "Save" },
    "common.cancel": { ja: "キャンセル", en: "Cancel" },
    "common.delete": { ja: "削除", en: "Delete" },
    "common.edit": { ja: "編集", en: "Edit" },
    "common.close": { ja: "閉じる", en: "Close" },
    "common.details": { ja: "詳細", en: "Details" },
    "common.loading": { ja: "読み込み中…", en: "Loading…" },
    "common.error_prefix": { ja: "読み込みに失敗しました: {{msg}}", en: "Failed to load: {{msg}}" },
    "common.back_to_list": { ja: "← 一覧に戻る", en: "← Back to list" },
    "common.view_conversation": { ja: "会話を見る →", en: "View conversation →" },
    "common.dash": { ja: "—", en: "—" },
    "common.list_separator": { ja: "、", en: ", " },
    "common.prev": { ja: "← 前へ", en: "← Previous" },
    "common.next": { ja: "次へ →", en: "Next →" },
    "common.count_range": { ja: "{{from}}–{{to}} / {{total}} 件", en: "{{from}}–{{to}} of {{total}}" },
    "common.count_zero": { ja: "0 件", en: "0" },
    "common.fetch_failed": { ja: "取得に失敗しました", en: "Failed to fetch" },

    // ---------------- nav ----------------
    "nav.dashboard": { ja: "ダッシュボード", en: "Dashboard" },
    "nav.conversations": { ja: "会話ログ", en: "Conversations" },
    "nav.feedback": { ja: "フィードバック", en: "Feedback" },
    "nav.knowledge": { ja: "ナレッジ", en: "Knowledge" },
    "nav.users": { ja: "管理者", en: "Administrators" },
    "nav.settings": { ja: "設定", en: "Settings" },
    "nav.audit": { ja: "監査ログ", en: "Audit Log" },
    "nav.analytics": { ja: "アクセス解析", en: "Analytics" },

    // ---------------- shell chrome (admin.js) ----------------
    "shell.signout": { ja: "ログアウト", en: "Sign out" },
    "shell.menu": { ja: "☰ メニュー", en: "☰ Menu" },
    "shell.noaccess_lede": {
      ja: "ログインは成功しましたが、この管理画面へのアクセス権がありません。オーナーに管理者登録を依頼してください。",
      en: "You're signed in, but don't have access to this admin console. Ask an owner to register you as an admin.",
    },

    // ---------------- login.html ----------------
    "login.title": { ja: "ログイン | AMASAS Admin", en: "Sign In | AMASAS Admin" },
    "login.lede": {
      ja: "海士町オープンデータ・チャットの管理画面です。スタッフ用アカウントでサインインしてください。",
      en: "This is the admin console for the Amasas open-data chat. Sign in with your staff account.",
    },
    "login.email": { ja: "メールアドレス", en: "Email address" },
    "login.password": { ja: "パスワード", en: "Password" },
    "login.signin": { ja: "サインイン", en: "Sign in" },
    "login.signin_progress": { ja: "サインイン中…", en: "Signing in…" },
    "login.forgot": { ja: "パスワードをお忘れですか？", en: "Forgot your password?" },
    "login.forgot_email_required": { ja: "先にメールアドレスを入力してください", en: "Enter your email address first" },
    "login.reset_sent": {
      ja: "登録されているアドレスであれば、パスワード再設定メールを送信しました。",
      en: "If that address is registered, a password reset email has been sent.",
    },
    "login.link_invalid": {
      ja: "招待/再設定リンクが無効です（期限切れ、または既に使用済みの可能性があります）。もう一度招待し直すか、パスワード再設定をやり直してください。",
      en: "This invite/reset link is invalid (it may be expired or already used). Please request a new invite, or try resetting your password again.",
    },
    "login.link_invalid_detail": { ja: "詳細: {{detail}}", en: "Details: {{detail}}" },
    "login.set_password_recovery": { ja: "新しいパスワードを設定してください。", en: "Please set a new password." },
    "login.set_password_invite": {
      ja: "招待を受けました。ログイン用のパスワードを設定してください。",
      en: "You've been invited. Please set a password to sign in.",
    },
    "login.new_password": { ja: "新しいパスワード", en: "New password" },
    "login.confirm_password": { ja: "確認", en: "Confirm" },
    "login.set_password_submit": { ja: "パスワードを設定してログイン", en: "Set password and sign in" },
    "login.setting_progress": { ja: "設定中…", en: "Setting…" },
    "login.password_mismatch": { ja: "パスワードが一致しません", en: "Passwords don't match" },

    // ---------------- dashboard (index.html) ----------------
    "dashboard.title": { ja: "ダッシュボード", en: "Dashboard" },
    "dashboard.sub": {
      ja: "会話・フィードバックの実データと、公開チャットの稼働状況",
      en: "Live conversation and feedback data, and the public chat's operating status",
    },
    "dashboard.aggregating": { ja: "集計中…", en: "Aggregating…" },
    "dashboard.maintenance_banner": {
      ja: "⚠ メンテナンスモードが有効です。公開チャットは現在利用できません。（<a href=\"settings.html\">設定で解除</a>）",
      en: "⚠ Maintenance mode is on. The public chat is currently unavailable. (<a href=\"settings.html\">Turn it off in Settings</a>)",
    },
    "dashboard.kpi.sessions_total": { ja: "セッション数（全期間）", en: "Sessions (all time)" },
    "dashboard.kpi.sessions_note": { ja: "直近7日: {{d7}} ・ 直近30日: {{d30}}", en: "Last 7 days: {{d7}} · Last 30 days: {{d30}}" },
    "dashboard.kpi.messages_total": { ja: "メッセージ数（全期間）", en: "Messages (all time)" },
    "dashboard.kpi.messages_note": { ja: "ユーザー発話+AI応答の合計", en: "Total of user turns + AI responses" },
    "dashboard.kpi.feedback": { ja: "フィードバック", en: "Feedback" },
    "dashboard.kpi.feedback_note": { ja: "👍 {{ok}} ・ 👎 {{ng}}", en: "👍 {{ok}} · 👎 {{ng}}" },
    "dashboard.kpi.feedback_none": { ja: "まだ評価がありません", en: "No ratings yet" },
    "dashboard.kpi.sql_error_rate": { ja: "SQLエラー率（直近500件中）", en: "SQL error rate (last 500)" },
    "dashboard.kpi.sql_error_note": { ja: "{{n}} 件でクエリエラーが発生", en: "{{n}} queries errored" },
    "dashboard.system_status": { ja: "システム状態", en: "System status" },
    "dashboard.system_status_unavailable": { ja: "システム状態を取得できませんでした", en: "Couldn't retrieve system status" },
    "dashboard.model_usage": { ja: "モデル使用内訳（直近500件）", en: "Model usage breakdown (last 500)" },
    "dashboard.data_layer_usage": { ja: "データ層内訳（直近500件）", en: "Data layer breakdown (last 500)" },
    "dashboard.no_data": { ja: "データがありません", en: "No data" },
    "dashboard.recent_sessions": { ja: "最近のセッション", en: "Recent sessions" },
    "dashboard.no_conversations": { ja: "まだ会話がありません", en: "No conversations yet" },
    "dashboard.ng_feedback_title": { ja: "対応が必要なフィードバック（👎）", en: "Feedback needing attention (👎)" },
    "dashboard.ng_feedback_none": { ja: "未対応のネガティブフィードバックはありません", en: "No unresolved negative feedback" },
    "dashboard.th.datetime": { ja: "日時", en: "Date" },
    "dashboard.th.nickname": { ja: "ニックネーム", en: "Nickname" },
    "dashboard.th.role_tag": { ja: "お立場", en: "Relationship" },
    "dashboard.th.speaker": { ja: "発言者", en: "Speaker" },
    "dashboard.th.answer": { ja: "該当回答", en: "Relevant answer" },
    "dashboard.th.comment": { ja: "コメント", en: "Comment" },
    "dashboard.model_summary": {
      ja: "使用モデル: {{model}}（混雑時フォールバック: {{fallback}}）・データ層既定: {{layer}}",
      en: "Model in use: {{model}} (fallback under load: {{fallback}}) · Default data layer: {{layer}}",
    },
    "dashboard.health.db_reachable": { ja: "DB 疎通", en: "DB reachable" },

    // ---------------- conversations.html ----------------
    "conversations.title": { ja: "会話ログ", en: "Conversations" },
    "conversations.sub": { ja: "公開チャットのセッション・メッセージを閲覧します", en: "Browse public chat sessions and messages" },
    "conversations.field.nickname": { ja: "ニックネーム", en: "Nickname" },
    "conversations.field.role_tag": { ja: "あなたと海士町との関係", en: "Relationship to Amakusa" },
    "conversations.field.started_at": { ja: "開始日時", en: "Started" },
    "conversations.field.session_id": { ja: "セッションID", en: "Session ID" },
    "conversations.no_messages": { ja: "メッセージがありません", en: "No messages" },
    "conversations.sql_log_summary": {
      ja: "SQL照会 {{count}}件{{errorNote}}",
      en: "{{count}} SQL {{queryWord}}{{errorNote}}",
    },
    "conversations.sql_log_has_error": { ja: "（エラーあり）", en: " (with errors)" },
    "conversations.sql_log_error_prefix": { ja: "→ ERROR: ", en: "→ ERROR: " },
    "conversations.sql_log_rows": { ja: "→ {{n}} 行", en: "→ {{n}} rows" },
    "conversations.filter.nickname": { ja: "ニックネームで検索", en: "Search by nickname" },
    "conversations.filter.role_tag": { ja: "お立場で絞り込み", en: "Filter by relationship" },
    "conversations.filter.from": { ja: "開始日", en: "From date" },
    "conversations.filter.to": { ja: "終了日", en: "To date" },
    "conversations.filter.apply": { ja: "絞り込み", en: "Apply" },
    "conversations.filter.clear": { ja: "クリア", en: "Clear" },
    "conversations.th.message_count": { ja: "メッセージ数", en: "Messages" },
    "conversations.no_results": { ja: "条件に一致する会話がありません", en: "No conversations match these filters" },

    // ---------------- feedback.html ----------------
    "feedback.title": { ja: "フィードバック", en: "Feedback" },
    "feedback.sub": { ja: "回答への 👍 / 👎 評価とコメントの一覧", en: "List of 👍/👎 ratings and comments on answers" },
    "feedback.filter.all": { ja: "すべて", en: "All" },
    "feedback.filter.ok_only": { ja: "👍 のみ", en: "👍 only" },
    "feedback.filter.ng_only": { ja: "👎 のみ", en: "👎 only" },
    "feedback.th.verdict": { ja: "評価", en: "Rating" },
    "feedback.no_results": { ja: "該当するフィードバックがありません", en: "No feedback matches these filters" },

    // ---------------- settings.html ----------------
    "settings.title": { ja: "設定", en: "Settings" },
    "settings.sub": { ja: "公開チャットの稼働設定と、現在の実行時構成（診断用）", en: "Public chat operating settings, and the current runtime configuration (diagnostic)" },
    "settings.maintenance_heading": { ja: "メンテナンスモード", en: "Maintenance mode" },
    "settings.runtime_heading": { ja: "実行時構成（診断用・読み取り専用）", en: "Runtime configuration (diagnostic, read-only)" },
    "settings.runtime_note": {
      ja: "Gemini / データ層のモデル値は Vercel の環境変数（Project Settings → Environment Variables）で設定します。この画面からは変更できません。",
      en: "The Gemini / data-layer model values are set via Vercel environment variables (Project Settings → Environment Variables). They can't be changed from this screen.",
    },
    "settings.maintenance_enable": { ja: "メンテナンスモードを有効にする", en: "Enable maintenance mode" },
    "settings.maintenance_message_label": { ja: "公開チャットに表示するメッセージ（任意）", en: "Message shown on the public chat (optional)" },
    "settings.maintenance_message_placeholder": {
      ja: "ただいまメンテナンス中です。しばらくしてから再度お試しください。",
      en: "The chat is currently under maintenance. Please try again later.",
    },
    "settings.saved": { ja: "保存しました", en: "Saved" },
    "settings.health_fetch_failed": { ja: "取得に失敗しました", en: "Failed to fetch" },
    "settings.field.vercel_env": { ja: "Vercel環境", en: "Vercel environment" },
    "settings.field.gemini_model": { ja: "Gemini モデル", en: "Gemini model" },
    "settings.field.fallback_model": { ja: "混雑時フォールバック", en: "Fallback under load" },
    "settings.field.data_layer": { ja: "データ層既定", en: "Default data layer" },
    "settings.chip.gemini_key": { ja: "GEMINI_API_KEY 設定済み", en: "GEMINI_API_KEY set" },
    "settings.chip.service_key": { ja: "SUPABASE_SERVICE_KEY 設定済み", en: "SUPABASE_SERVICE_KEY set" },
    "settings.chip.db_reachable": { ja: "Supabase 読み取り疎通", en: "Supabase read connectivity" },

    // ---------------- audit.html ----------------
    "audit.title": { ja: "監査ログ", en: "Audit Log" },
    "audit.sub": {
      ja: "ナレッジ編集・管理者ロール変更は自動的にここへ記録されます",
      en: "Knowledge edits and admin role changes are automatically recorded here",
    },
    "audit.count_range": { ja: "{{from}}〜{{to}} 件", en: "{{from}}–{{to}}" },
    "audit.th.datetime": { ja: "日時", en: "Date" },
    "audit.th.actor": { ja: "実行者", en: "Actor" },
    "audit.th.action": { ja: "操作", en: "Action" },
    "audit.th.target": { ja: "対象", en: "Target" },
    "audit.no_records": { ja: "記録がありません", en: "No records" },

    // ---------------- analytics.html ----------------
    "analytics.title": { ja: "アクセス解析", en: "Analytics" },
    "analytics.sub": { ja: "公開チャットのアクセスと利用状況", en: "Traffic and activity on the public chat app" },
    "analytics.range.today": { ja: "今日", en: "Today" },
    "analytics.range.7d": { ja: "7日間", en: "7 Days" },
    "analytics.range.30d": { ja: "30日間", en: "30 Days" },
    "analytics.range.3m": { ja: "3ヶ月", en: "3 Months" },
    "analytics.range.1y": { ja: "1年間", en: "1 Year" },
    "analytics.range.custom": { ja: "カスタム", en: "Custom" },
    "analytics.range.from": { ja: "開始日", en: "From" },
    "analytics.range.to": { ja: "終了日", en: "To" },
    "analytics.range.apply": { ja: "適用", en: "Apply" },
    "analytics.kpi.sessions": { ja: "セッション数", en: "Sessions" },
    "analytics.kpi.unique_visitors": { ja: "ユニーク来訪者数", en: "Unique Visitors" },
    "analytics.kpi.new_visitors": { ja: "新規来訪者", en: "New Visitors" },
    "analytics.kpi.returning_visitors": { ja: "再訪来訪者", en: "Returning Visitors" },
    "analytics.kpi.landing_views": { ja: "ランディング閲覧数", en: "Landing Views" },
    "analytics.kpi.chat_started": { ja: "チャット開始数", en: "Chats Started" },
    "analytics.kpi.avg_duration": { ja: "平均セッション時間", en: "Avg. Session Duration" },
    "analytics.kpi.feedback": { ja: "フィードバック", en: "Feedback" },
    "analytics.dau": { ja: "DAU（日次アクティブ来訪者）", en: "DAU (Daily Active Visitors)" },
    "analytics.wau": { ja: "WAU（週次アクティブ来訪者）", en: "WAU (Weekly Active Visitors)" },
    "analytics.mau": { ja: "MAU（月次アクティブ来訪者）", en: "MAU (Monthly Active Visitors)" },
    "analytics.chart.growth": { ja: "来訪者数の推移", en: "Visitor Growth" },
    "analytics.chart.traffic": { ja: "アクセス推移", en: "Traffic Over Time" },
    "analytics.chart.new_vs_returning": { ja: "新規 vs 再訪", en: "New vs Returning" },
    "analytics.chart.device": { ja: "デバイス別内訳", en: "Device Distribution" },
    "analytics.chart.browser": { ja: "ブラウザ別内訳", en: "Browser" },
    "analytics.chart.os": { ja: "OS別内訳", en: "Operating System" },
    "analytics.chart.country": { ja: "国・地域別内訳", en: "Country / Region" },
    "analytics.chart.features": { ja: "よく使われる機能", en: "Most Used Features" },
    "analytics.chart.role": { ja: "お立場別の利用状況", en: "Usage by Role" },
    "analytics.event.landing_view": { ja: "ランディング閲覧", en: "Landing view" },
    "analytics.event.chat_started": { ja: "チャット開始", en: "Chat started" },
    "analytics.event.message_sent": { ja: "メッセージ送信", en: "Message sent" },
    "analytics.event.feedback_given": { ja: "フィードバック送信", en: "Feedback given" },
    "analytics.table.heading": { ja: "来訪者アクティビティ", en: "User Activity" },
    "analytics.table.search": { ja: "ニックネームで検索", en: "Search by nickname" },
    "analytics.table.role_all": { ja: "すべてのお立場", en: "All roles" },
    "analytics.table.status_all": { ja: "すべての状態", en: "All statuses" },
    "analytics.th.nickname": { ja: "ニックネーム", en: "User" },
    "analytics.th.role": { ja: "お立場", en: "Role" },
    "analytics.th.first_seen": { ja: "初回訪問", en: "First Seen" },
    "analytics.th.last_active": { ja: "最終アクティブ", en: "Last Active" },
    "analytics.th.sessions": { ja: "セッション数", en: "Sessions" },
    "analytics.th.status": { ja: "状態", en: "Status" },
    "analytics.status.active": { ja: "アクティブ", en: "Active" },
    "analytics.status.inactive": { ja: "非アクティブ", en: "Inactive" },
    "analytics.no_data": { ja: "この期間のデータはありません", en: "No data for this range" },
    "analytics.no_results": { ja: "条件に一致する来訪者がいません", en: "No visitors match these filters" },
    "analytics.unknown": { ja: "不明", en: "Unknown" },
    "analytics.duration_seconds": { ja: "{{n}}秒", en: "{{n}}s" },
    "analytics.duration_minutes": { ja: "{{n}}分", en: "{{n}}m" },

    // role_tag values from index.html's ROLES list -- shown in the
    // breakdown chart and the User Activity table's role filter/column.
    "roletag.not_visited": { ja: "まだ行ったことはない・情報収集中", en: "Haven't visited yet / researching" },
    "roletag.visited": { ja: "海士町に行ったことがある", en: "Has visited Amasas" },
    "roletag.ambassador": { ja: "海士町オフィシャルアンバサダー", en: "Official Amasas Ambassador" },
    "roletag.island_study": { ja: "島留学・大人の島留学の参加者・卒業生", en: "Island Study program participant/alum" },
    "roletag.student": { ja: "町内の小中高生", en: "Local student" },
    "roletag.resident": { ja: "町内在住・町内勤務", en: "Resident / works locally" },
    "roletag.townhall": { ja: "役場・関係機関", en: "Town office / affiliated org" },
    "roletag.corporate": { ja: "企業・団体として連携を検討中", en: "Company/org considering partnership" },
    "roletag.project": { ja: "プロジェクト・運営関係者", en: "Project / operations staff" },
    "roletag.other": { ja: "その他", en: "Other" },

    // ---------------- users.html ----------------
    "users.title": { ja: "管理者", en: "Administrators" },
    "users.sub": { ja: "この管理画面にアクセスできるスタッフアカウントとロール", en: "Staff accounts and roles with access to this admin console" },
    "users.invite_heading": { ja: "新しい管理者を招待", en: "Invite a new admin" },
    "users.field.email": { ja: "メールアドレス *", en: "Email address *" },
    "users.field.display_name": { ja: "表示名", en: "Display name" },
    "users.field.role": { ja: "ロール *", en: "Role *" },
    "users.invite_submit": { ja: "招待メールを送信", en: "Send invite email" },
    "users.invite_note": {
      ja: "Supabase Auth の招待メール機能を使います。届かない場合は Supabase ダッシュボードから直接ユーザーを作成してください。",
      en: "Uses Supabase Auth's invite email feature. If it doesn't arrive, create the user directly from the Supabase dashboard instead.",
    },
    "users.invite_failed": { ja: "招待に失敗しました", en: "Invite failed" },
    "users.invite_sent": { ja: "招待メールを送信しました", en: "Invite email sent" },
    "users.permissions_heading": { ja: "ロールの権限", en: "Role permissions" },
    "users.th.capability": { ja: "できること", en: "Can do" },
    "users.cap.view_basics": { ja: "ダッシュボード・会話ログ・フィードバックの閲覧", en: "View dashboard, conversations, and feedback" },
    "users.cap.view_knowledge": { ja: "ナレッジベースの閲覧", en: "View the knowledge base" },
    "users.cap.edit_knowledge": { ja: "ナレッジベースの編集", en: "Edit the knowledge base" },
    "users.cap.manage_admins": { ja: "管理者の招待・ロール変更・無効化", en: "Invite admins, change roles, deactivate accounts" },
    "users.cap.delete_admins": { ja: "管理者の削除（元に戻せません）", en: "Delete admins (permanent)" },
    "users.cap.settings": { ja: "設定（メンテナンスモード等）の変更", en: "Change settings (maintenance mode, etc.)" },
    "users.cap.audit_log": { ja: "監査ログの閲覧", en: "View the audit log" },
    "users.cap.admin_restricted": { ja: "✓（owner以外は編集不可）", en: "✓ (only owner can edit others)" },
    "users.th.email": { ja: "メール", en: "Email" },
    "users.th.display_name": { ja: "表示名", en: "Display name" },
    "users.th.role": { ja: "ロール", en: "Role" },
    "users.th.status": { ja: "状態", en: "Status" },
    "users.th.last_login": { ja: "最終ログイン", en: "Last login" },
    "users.th.created": { ja: "登録日", en: "Registered" },
    "users.status.active": { ja: "有効", en: "Active" },
    "users.status.inactive": { ja: "無効", en: "Inactive" },
    "users.action.deactivate": { ja: "無効化", en: "Deactivate" },
    "users.action.activate": { ja: "有効化", en: "Activate" },
    "users.confirm_activate_title": { ja: "このアカウントを有効化しますか？", en: "Activate this account?" },
    "users.confirm_deactivate_title": { ja: "このアカウントを無効化しますか？", en: "Deactivate this account?" },
    "users.confirm_deactivate_body": {
      ja: "無効化すると、このユーザーは管理画面にログインできなくなります（アカウント自体は削除されません）。",
      en: "Once deactivated, this user won't be able to sign in to the admin console (their account itself isn't deleted).",
    },
    "users.updated": { ja: "更新しました", en: "Updated" },
    "users.delete.button": { ja: "削除", en: "Delete" },
    "users.delete.title": { ja: "{{email}} を削除しますか？", en: "Delete {{email}}?" },
    "users.delete.body": {
      ja: "アカウントと管理者権限が完全に削除されます。この操作は元に戻せません。無効化と違い、後で同じロールに戻すことはできません。",
      en: "The account and its admin access will be permanently deleted. This can't be undone — unlike deactivation, you can't restore this account to its previous role later.",
    },
    "users.delete.confirm": { ja: "完全に削除する", en: "Delete permanently" },
    "users.delete.failed": { ja: "削除に失敗しました", en: "Delete failed" },
    "users.delete.done": { ja: "削除しました", en: "Deleted" },

    // ---------------- knowledge.html ----------------
    "knowledge.title": { ja: "ナレッジベース", en: "Knowledge Base" },
    "knowledge.sub": {
      ja: "AIの回答（l4データ層）に注入される町の公式コンテンツを編集します",
      en: "Edit the town's official content that's injected into the AI's answers (the l4 data layer)",
    },
    "knowledge.add_row": { ja: "+ 新規追加", en: "+ Add new" },
    "knowledge.no_rows": { ja: "データがありません", en: "No rows" },
    "knowledge.delete_row_title": { ja: "この行を削除しますか？", en: "Delete this row?" },
    "knowledge.delete_row_body": {
      ja: "knowledge.{{table}} / {{pk}} = {{pkVal}}<br>この操作は取り消せません。監査ログに記録されます。",
      en: "knowledge.{{table}} / {{pk}} = {{pkVal}}<br>This can't be undone. It will be recorded in the audit log.",
    },
    "knowledge.delete_confirm": { ja: "削除する", en: "Delete" },
    "knowledge.delete_done": { ja: "削除しました", en: "Deleted" },
    "knowledge.modal.new": { ja: "新規追加", en: "Add new" },
    "knowledge.modal.view": { ja: "詳細", en: "Details" },
    "knowledge.modal.edit": { ja: "編集", en: "Edit" },
    "knowledge.save_done": { ja: "保存しました", en: "Saved" },
    "knowledge.missing_required": { ja: "必須項目が未入力です: {{fields}}", en: "Required fields missing: {{fields}}" },

    // knowledge.html TABLES config: table labels/notes and per-field labels
    // are looked up via the local L() helper in the page itself (each holds
    // {ja, en} directly), NOT through this dictionary -- see plan.
  };

  function getLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === "en" ? "en" : "ja";
    } catch { return "ja"; }
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang === "en" ? "en" : "ja"); } catch { /* ignore */ }
    location.reload();
  }

  function t(key, vars) {
    const entry = STRINGS[key];
    let s = entry ? entry[getLang()] : key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        s = s.split(`{{${k}}}`).join(vars[k]);
      }
    }
    return s;
  }

  return { t, getLang, setLang };
})();
