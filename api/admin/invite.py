"""Admin invite: create the Supabase Auth user, then send the invite email
ourselves over SMTP (see _mail.py for why Supabase's mailer isn't used).

Order: generate invite link (sends nothing) -> register admin role (caller's
own token, so the SQL escalation rules still apply) -> send email. If
registering or sending fails, the half-created auth user is deleted
(admin.admin_users cascades), so the same address can be invited again.

Env: SUPABASE_SERVICE_KEY, NOREPLY_EMAIL_PWD.
"""

import json
import os
import re
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _mail  # noqa: E402

SUPABASE_URL = _mail.SUPABASE_URL
ANON_KEY = _mail.ANON_KEY
ROLES = ("owner", "admin", "editor", "viewer")

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


def send_invite_email(to_email, link, site_url):
    _mail.send_email("invite", to_email, link, site_url)


def invite(token, body, host, http=_mail.http_json, send=send_invite_email):
    """Core logic, separated from the HTTP handler for testing. Returns (status, dict)."""
    if not token:
        return 401, {"error": "unauthorized"}
    body = body if isinstance(body, dict) else {}
    email = str(body.get("email") or "").strip()
    role = body.get("role")
    display_name = str(body.get("displayName") or "").strip() or None
    if not _mail.valid_email(email) or role not in ROLES:
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
    st, action_link, user_id, raw = _mail.generate_link("invite", email, f"{site_url}/admin/login.html", service_key, http)
    if st != 200:
        return 502, {"error": _mail.error_text(raw, "招待リンクの作成に失敗しました")}
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
        return 502, {"error": _mail.error_text(reg, "管理者登録に失敗しました")}

    try:
        send(email, action_link, site_url)
    except Exception as e:  # noqa: BLE001 - any SMTP/network failure is reported the same way
        rollback()
        print(json.dumps({"level": "error", "msg": "invite email send failed", "error": type(e).__name__}))
        return 502, {"error": "招待メールの送信に失敗しました（SMTP）。設定を確認してから再度招待してください"}

    return 200, {"ok": True, "user": reg}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        _mail.respond(self, 405, {"error": "POST only"})

    def do_POST(self):
        if rate_limited():
            return _mail.respond(self, 429, {"error": "招待が続けて行われています。しばらく待ってから再試行してください"})
        token = re.sub(r"^Bearer\s+", "", self.headers.get("Authorization", ""), flags=re.I)
        status, payload = invite(token, _mail.read_json_body(self), self.headers.get("Host", ""))
        _mail.respond(self, status, payload)
