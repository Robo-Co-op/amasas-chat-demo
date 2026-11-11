"""Admin invite: create the Supabase Auth user, then send the invite email
ourselves over SMTP (noreply@robocoop.org via Hostinger).

Supabase Auth's own mailer is not used: it depends on SMTP settings stored
inside the Supabase project, which do not move with the database. This uses
GoTrue's admin `generate_link`, which creates the user and returns the invite
link WITHOUT sending anything. The link is then mailed from here using
supabase/email-templates/invite.html.

Order: generate link -> register admin role (caller's own token, so the SQL
escalation rules still apply) -> send email. If registering or sending fails,
the half-created auth user is deleted (admin.admin_users cascades), so the
same address can simply be invited again.

Env: SUPABASE_SERVICE_KEY, NOREPLY_EMAIL_PWD (required);
     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM_NAME (optional overrides).
"""

import html
import json
import os
import re
import smtplib
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = "https://hyedzuckgyadlpsfksrb.supabase.co"
ANON_KEY = "sb_publishable_RjUDgV5nwIOI050ZWpPFMA_oqdkIsiY"
ROLES = ("owner", "admin", "editor", "viewer")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SUBJECT = "AMASAS 管理者への招待"
TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "supabase", "email-templates", "invite.html"
)

# Best-effort per-instance rate limit (same as the old JS handler).
_hits = []


def rate_limited(now=None):
    now = time.time() if now is None else now
    while _hits and now - _hits[0] > 60:
        _hits.pop(0)
    if len(_hits) >= 10:
        return True
    _hits.append(now)
    return False


def http_json(method, url, headers, body=None, timeout=15):
    """Returns (status, parsed JSON or None). Never raises on HTTP errors."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, {"msg": str(e)}
    try:
        return status, json.loads(raw) if raw else None
    except ValueError:
        return status, None


def render_template(link, email, site_url):
    try:
        with open(TEMPLATE_PATH, encoding="utf-8") as f:
            tpl = f.read()
        tpl = re.sub(r"^\s*<!--.*?-->\s*", "", tpl, count=1, flags=re.S)  # drop the "paste into Supabase" note
    except OSError:
        tpl = (
            '<p>AMASAS 管理コンソールに招待されました。</p>'
            '<p><a href="{{ .ConfirmationURL }}">招待を承認してパスワードを設定する</a></p>'
        )
    return (
        tpl.replace("{{ .ConfirmationURL }}", html.escape(link, quote=True))
        .replace("{{ .Email }}", html.escape(email))
        .replace("{{ .SiteURL }}", html.escape(site_url, quote=True))
    )


def send_invite_email(to_email, link, site_url):
    password = os.environ.get("NOREPLY_EMAIL_PWD")
    if not password:
        raise RuntimeError("NOREPLY_EMAIL_PWD is not set")
    host = os.environ.get("SMTP_HOST", "smtp.hostinger.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER", "noreply@robocoop.org")
    from_name = os.environ.get("SMTP_FROM_NAME", "Robo Co-op (AMASAS)")

    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = formataddr((from_name, user))
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=user.split("@")[-1])
    msg.set_content(
        "AMASAS 管理コンソールに招待されました。\n"
        "次のリンクを開いてパスワードを設定してください:\n\n"
        f"{link}\n\n"
        "心当たりがない場合は、このメールを無視してください。\n"
    )
    msg.add_alternative(render_template(link, to_email, site_url), subtype="html")

    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=20) as s:
            s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.starttls(context=ctx)
            s.login(user, password)
            s.send_message(msg)


def _err(data, fallback):
    if isinstance(data, dict):
        return data.get("msg") or data.get("message") or data.get("error_description") or data.get("error") or fallback
    return fallback


def invite(token, body, host, http=http_json, send=send_invite_email):
    """Core logic, separated from the HTTP handler for testing. Returns (status, dict)."""
    if not token:
        return 401, {"error": "unauthorized"}
    body = body if isinstance(body, dict) else {}
    email = str(body.get("email") or "").strip()
    role = body.get("role")
    display_name = (str(body.get("displayName") or "").strip() or None)
    if not EMAIL_RE.match(email) or role not in ROLES:
        return 400, {"error": "bad request"}

    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        return 500, {"error": "SUPABASE_SERVICE_KEY が未設定のため招待できません"}
    if not os.environ.get("NOREPLY_EMAIL_PWD"):
        return 500, {"error": "NOREPLY_EMAIL_PWD が未設定のため招待メールを送信できません"}

    caller_headers = {"apikey": ANON_KEY, "Authorization": f"Bearer {token}"}
    service_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    st, who = http("POST", f"{SUPABASE_URL}/rest/v1/rpc/admin_whoami", caller_headers, {})
    caller_role = who.get("role") if st == 200 and isinstance(who, dict) else None
    if caller_role not in ("owner", "admin"):
        return 403, {"error": "招待する権限がありません"}
    if caller_role == "admin" and role in ("owner", "admin"):
        return 403, {"error": "admin ロールは owner / admin を招待できません"}

    # Must be in Supabase's Redirect URLs allowlist, or GoTrue falls back to the Site URL.
    site_url = f"https://{host}"
    redirect_to = f"{site_url}/admin/login.html"

    st, link_data = http(
        "POST",
        f"{SUPABASE_URL}/auth/v1/admin/generate_link",
        service_headers,
        {"type": "invite", "email": email, "redirect_to": redirect_to},
    )
    if st != 200 or not isinstance(link_data, dict):
        return 502, {"error": _err(link_data, "招待リンクの作成に失敗しました")}
    props = link_data.get("properties") or {}
    user = link_data.get("user") or {}
    action_link = link_data.get("action_link") or props.get("action_link")
    user_id = link_data.get("id") or user.get("id")
    if not action_link or not user_id:
        return 502, {"error": "招待リンクの作成に失敗しました"}

    def rollback():
        http("DELETE", f"{SUPABASE_URL}/auth/v1/admin/users/{urllib.parse.quote(user_id)}", service_headers)

    st, reg = http(
        "POST",
        f"{SUPABASE_URL}/rest/v1/rpc/admin_register_user",
        caller_headers,
        {"new_id": user_id, "new_email": email, "new_role": role, "new_display_name": display_name},
    )
    if st != 200:
        rollback()
        return 502, {"error": _err(reg, "管理者登録に失敗しました")}

    try:
        send(email, action_link, site_url)
    except Exception as e:  # noqa: BLE001 - any SMTP/network failure is reported the same way
        rollback()
        print(json.dumps({"level": "error", "msg": "invite email send failed", "error": type(e).__name__}))
        return 502, {"error": "招待メールの送信に失敗しました（SMTP）。設定を確認してから再度招待してください"}

    return 200, {"ok": True, "user": reg}


class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        out = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_GET(self):
        self._send(405, {"error": "POST only"})

    def do_POST(self):
        if rate_limited():
            return self._send(429, {"error": "招待が続けて行われています。しばらく待ってから再試行してください"})
        token = re.sub(r"^Bearer\s+", "", self.headers.get("Authorization", ""), flags=re.I)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(min(length, 10_000)) or b"{}")
        except ValueError:
            body = {}
        status, payload = invite(token, body, self.headers.get("Host", ""))
        self._send(status, payload)
