"""Shared helpers for the admin auth emails (invite, password reset).

Supabase Auth's own mailer is not used: its SMTP settings live inside the
Supabase project and did not move with the database. Instead the Python
functions ask GoTrue's admin `generate_link` for the link (which sends
nothing) and mail it from here through noreply@robocoop.org.

The leading underscore keeps Vercel from exposing this file as an endpoint.

Env: NOREPLY_EMAIL_PWD (required to send);
     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM_NAME (optional overrides).
"""

import html
import json
import os
import re
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

SUPABASE_URL = "https://hyedzuckgyadlpsfksrb.supabase.co"
ANON_KEY = "sb_publishable_RjUDgV5nwIOI050ZWpPFMA_oqdkIsiY"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "supabase", "email-templates")

# Per email kind: subject, template file, plain-text body, fallback HTML if the template is missing.
KINDS = {
    "invite": {
        "subject": "AMASAS 管理者への招待",
        "template": "invite.html",
        "text": "AMASAS 管理コンソールに招待されました。\n次のリンクを開いてパスワードを設定してください:\n\n{link}\n\n"
        "心当たりがない場合は、このメールを無視してください。\n",
        "fallback": '<p>AMASAS 管理コンソールに招待されました。</p><p><a href="{{ .ConfirmationURL }}">招待を承認してパスワードを設定する</a></p>',
    },
    "recovery": {
        "subject": "AMASAS パスワード再設定",
        "template": "recovery.html",
        "text": "AMASAS 管理コンソールのパスワード再設定が依頼されました。\n次のリンクを開いて新しいパスワードを設定してください:\n\n{link}\n\n"
        "心当たりがない場合は、このメールを無視してください（パスワードは変更されません）。\n",
        "fallback": '<p>AMASAS 管理コンソールのパスワード再設定</p><p><a href="{{ .ConfirmationURL }}">新しいパスワードを設定する</a></p>',
    },
}


def valid_email(email):
    return bool(EMAIL_RE.match(email or ""))


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


def generate_link(kind, email, redirect_to, service_key, http=http_json):
    """GoTrue admin generate_link. Returns (status, action_link, user_id, raw). Sends no email."""
    st, data = http(
        "POST",
        f"{SUPABASE_URL}/auth/v1/admin/generate_link",
        {"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        {"type": kind, "email": email, "redirect_to": redirect_to},
    )
    if st != 200 or not isinstance(data, dict):
        return st, None, None, data
    props = data.get("properties") or {}
    user = data.get("user") or {}
    return st, data.get("action_link") or props.get("action_link"), data.get("id") or user.get("id"), data


def render_template(kind, link, email, site_url):
    spec = KINDS[kind]
    try:
        with open(os.path.join(TEMPLATE_DIR, spec["template"]), encoding="utf-8") as f:
            tpl = f.read()
        tpl = re.sub(r"^\s*<!--.*?-->\s*", "", tpl, count=1, flags=re.S)  # drop the "paste into Supabase" note
    except OSError:
        tpl = spec["fallback"]
    return (
        tpl.replace("{{ .ConfirmationURL }}", html.escape(link, quote=True))
        .replace("{{ .Email }}", html.escape(email))
        .replace("{{ .SiteURL }}", html.escape(site_url, quote=True))
    )


def send_email(kind, to_email, link, site_url):
    """Raises on any failure (missing password, SMTP auth, network)."""
    password = os.environ.get("NOREPLY_EMAIL_PWD")
    if not password:
        raise RuntimeError("NOREPLY_EMAIL_PWD is not set")
    host = os.environ.get("SMTP_HOST", "smtp.hostinger.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER", "noreply@robocoop.org")
    from_name = os.environ.get("SMTP_FROM_NAME", "Robo Co-op (AMASAS)")
    spec = KINDS[kind]

    msg = EmailMessage()
    msg["Subject"] = spec["subject"]
    msg["From"] = formataddr((from_name, user))
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=user.split("@")[-1])
    msg.set_content(spec["text"].format(link=link))
    msg.add_alternative(render_template(kind, link, to_email, site_url), subtype="html")

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


def error_text(data, fallback):
    if isinstance(data, dict):
        return data.get("msg") or data.get("message") or data.get("error_description") or data.get("error") or fallback
    return fallback


def read_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length") or 0)
        body = json.loads(handler.rfile.read(min(length, 10_000)) or b"{}")
        return body if isinstance(body, dict) else {}
    except ValueError:
        return {}


def respond(handler, status, payload):
    out = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(out)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(out)
