// AMASAS Admin — shared engine (auth, REST/RPC helpers, shell chrome).
// Same conventions as the public app's api/*.js: raw fetch against Supabase,
// no SDK, no build step. SUPABASE_URL/ANON_KEY are the same public values
// already hardcoded in api/chat.js (safe to duplicate client-side).
const Admin = (() => {
  const SUPABASE_URL = "https://jcokpgmqmtxefzjjenrx.supabase.co";
  const ANON_KEY = "sb_publishable_vw8EmUrhPDKBnD7BF0a8kA_N0DPF-es";
  const STORAGE_KEY = "amasas_admin_session";

  // Client-side mirror of the SQL role checks — UX only (shows/hides nav and
  // pages). The real boundary is admin.current_role() enforced inside every
  // public.admin_* RPC and the RLS policies on the chat-log tables.
  const PERMISSIONS = {
    owner: ["dashboard", "conversations", "feedback", "knowledge_view", "knowledge_edit", "users", "settings", "audit"],
    admin: ["dashboard", "conversations", "feedback", "knowledge_view", "knowledge_edit", "users", "settings", "audit"],
    editor: ["dashboard", "conversations", "feedback", "knowledge_view", "knowledge_edit"],
    viewer: ["dashboard", "conversations", "feedback", "knowledge_view"],
  };

  const NAV = [
    { key: "dashboard", href: "index.html", label: "ダッシュボード", icon: "DB" },
    { key: "conversations", href: "conversations.html", label: "会話ログ", icon: "CV" },
    { key: "feedback", href: "feedback.html", label: "フィードバック", icon: "FB" },
    { key: "knowledge_view", href: "knowledge.html", label: "ナレッジ", icon: "KB" },
    { key: "users", href: "users.html", label: "管理者", icon: "US" },
    { key: "settings", href: "settings.html", label: "設定", icon: "ST" },
    { key: "audit", href: "audit.html", label: "監査ログ", icon: "AU" },
  ];

  // ---------------- session/token storage ----------------

  function getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }
  function persistTokens(data) {
    setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 30000,
      user: data.user || null,
    });
  }

  async function signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || "メールアドレスかパスワードが違います");
    persistTokens(data);
    return data;
  }

  async function requestPasswordReset(email) {
    const redirectTo = `${location.origin}/admin/login.html`;
    await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ email }),
    });
    // Always resolve regardless of whether the account exists — don't leak
    // which emails are registered admins.
  }

  // Adopts a token set handed to us directly (e.g. from an invite/recovery
  // email link's URL hash) without a fresh password sign-in.
  function adoptSession(data) {
    persistTokens(data);
  }

  // Sets a new password on the account behind `accessToken` — used right
  // after an invite/recovery link lands, before any normal sign-in has
  // happened.
  async function setPassword(accessToken, newPassword) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.msg || data.error_description || "パスワードの設定に失敗しました");
    return data;
  }

  async function refresh() {
    const s = getSession();
    if (!s || !s.refresh_token) return null;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok) { setSession(null); return null; }
    persistTokens(await r.json());
    return getSession();
  }

  async function ensureToken() {
    let s = getSession();
    if (!s) return null;
    if (Date.now() >= s.expires_at) s = await refresh();
    return s;
  }

  async function signOut() {
    const s = getSession();
    if (s && s.access_token) {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.access_token}` },
        });
      } catch { /* best-effort */ }
    }
    setSession(null);
    location.href = "login.html";
  }

  // ---------------- REST / RPC ----------------

  async function restFetch(path, opts = {}) {
    const s = await ensureToken();
    const headers = Object.assign(
      { apikey: ANON_KEY, "Content-Type": "application/json" },
      opts.headers || {}
    );
    if (s) headers.Authorization = `Bearer ${s.access_token}`;
    return fetch(`${SUPABASE_URL}${path}`, Object.assign({}, opts, { headers }));
  }

  async function rest(path, opts) {
    const r = await restFetch(path, opts);
    if (!r.ok) {
      let msg = `HTTPエラー ${r.status}`;
      try {
        const j = await r.json();
        msg = j.message || j.error_description || j.hint || msg;
      } catch { /* body wasn't json */ }
      if (r.status === 403 || /forbidden/i.test(msg)) msg = "この操作を行う権限がありません";
      throw new Error(msg);
    }
    if (r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  async function rpc(name, args = {}) {
    return rest(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  }

  // Row count via PostgREST's exact-count header, without pulling the rows.
  async function restCount(table, query) {
    const r = await restFetch(`/rest/v1/${table}?${query}`, {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    if (!r.ok) return 0;
    const range = r.headers.get("content-range") || "";
    const total = range.split("/")[1];
    return total && total !== "*" ? parseInt(total, 10) : 0;
  }

  // ---------------- small utilities ----------------

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  }

  function can(role, key) {
    return !!(role && PERMISSIONS[role] && PERMISSIONS[role].includes(key));
  }

  function toast(msg, kind = "") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function confirmModal({ title, body, confirmLabel = "実行", danger = false }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `<div class="modal">
        <h3>${esc(title)}</h3>
        <div>${body}</div>
        <div class="actions">
          <button class="btn ghost" data-a="cancel">キャンセル</button>
          <button class="btn ${danger ? "danger" : "primary"}" data-a="ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.dataset.a === "cancel") { backdrop.remove(); resolve(false); }
        else if (e.target.dataset.a === "ok") { backdrop.remove(); resolve(true); }
      });
    });
  }

  // ---------------- shell ----------------

  function shellHtml({ role, email, title, sub }) {
    return `
    <div id="shell">
      <aside id="sidebar">
        <div class="brand">AMASAS<small>Admin Console</small></div>
        <nav id="nav"></nav>
        <div class="who">
          <div class="email">${esc(email)}</div>
          <span class="role badge role-${esc(role)}">${esc(role)}</span>
          <button id="signout" type="button">ログアウト</button>
        </div>
      </aside>
      <div id="main">
        <header id="topbar">
          <div>
            <button id="mobiletoggle" type="button">☰ メニュー</button>
            <h1>${esc(title)}</h1>
            ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
          </div>
        </header>
        <section id="content"><div class="loading">読み込み中…</div></section>
      </div>
    </div>`;
  }

  function noAccessHtml() {
    return `<div class="center-page"><div class="card authcard">
      <div class="brand">AMASAS<small>Admin Console</small></div>
      <p class="lede">ログインは成功しましたが、この管理画面へのアクセス権がありません。オーナーに管理者登録を依頼してください。</p>
      <button class="btn ghost" id="na-signout" type="button">サインアウト</button>
    </div></div>`;
  }

  // Renders the sidebar/topbar shell into <body>, checks the current user's
  // role/permission for `page`, and returns {role, email, profile} — or null
  // if it already redirected / rendered a blocking screen (caller should stop).
  async function renderShell({ page, title, sub }) {
    const s = getSession();
    if (!s) {
      const here = location.pathname.split("/").pop() || "index.html";
      location.href = `login.html?next=${encodeURIComponent(here)}`;
      return null;
    }

    let profile;
    try {
      profile = await rpc("admin_whoami");
    } catch {
      setSession(null);
      location.href = "login.html";
      return null;
    }
    if (!profile) {
      document.body.innerHTML = noAccessHtml();
      document.getElementById("na-signout").addEventListener("click", signOut);
      return null;
    }

    const role = profile.role;
    document.body.innerHTML = shellHtml({ role, email: profile.email, title, sub });

    const navEl = document.getElementById("nav");
    NAV.forEach((item) => {
      if (!can(role, item.key)) return;
      const a = document.createElement("a");
      a.className = "navlink" + (page === item.key ? " active" : "");
      a.href = item.href;
      a.innerHTML = `<span class="navicon">${item.icon}</span>${esc(item.label)}`;
      navEl.appendChild(a);
    });

    document.getElementById("signout").addEventListener("click", signOut);
    const toggle = document.getElementById("mobiletoggle");
    if (toggle) {
      toggle.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
    }

    if (!can(role, page)) {
      document.getElementById("content").innerHTML =
        `<div class="empty"><div class="big">🔒</div>このページを見る権限がありません（現在のロール: ${esc(role)}）</div>`;
      return null;
    }

    return { role, email: profile.email, profile };
  }

  return {
    SUPABASE_URL, ANON_KEY, PERMISSIONS, NAV,
    getSession, signIn, signOut, requestPasswordReset, ensureToken, refresh, adoptSession, setPassword,
    restFetch, rest, rpc, restCount,
    esc, fmtDate, can, toast, confirmModal,
    renderShell,
  };
})();
