"""Admin password reset: send the recovery email ourselves over SMTP
(see _mail.py for why Supabase's mailer isn't used).

Public endpoint (the user is signed out), so it:
- always answers 200 {"ok": true}, whether or not the address has an account,
  and pads the response to a minimum time so timing doesn't reveal it either;
- only mails addresses that already exist in Supabase Auth (GoTrue's
  recovery generate_link returns 404 for unknown users and creates nothing);
- rate-limits per instance: one email per address per minute, 20 requests a
  minute overall. GoTrue's own /recover limit doesn't apply to the admin API.

Env: SUPABASE_SERVICE_KEY, NOREPLY_EMAIL_PWD.
"""

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _mail  # noqa: E402

MIN_RESPONSE_SECONDS = 3.0
PER_EMAIL_COOLDOWN = 60
GLOBAL_LIMIT_PER_MIN = 20

_recent = []  # request timestamps
_last_sent = {}  # email -> timestamp


def throttled(email, now=None):
    now = time.time() if now is None else now
    while _recent and now - _recent[0] > 60:
        _recent.pop(0)
    if len(_recent) >= GLOBAL_LIMIT_PER_MIN:
        return True
    _recent.append(now)
    for k in [k for k, t in _last_sent.items() if now - t > PER_EMAIL_COOLDOWN]:
        del _last_sent[k]
    if email in _last_sent:
        return True
    _last_sent[email] = now
    return False


def send_recovery_email(to_email, link, site_url):
    _mail.send_email("recovery", to_email, link, site_url)


def password_reset(body, host, http=_mail.http_json, send=send_recovery_email, now=None):
    """Returns (status, dict, outcome). Status/dict are what the client sees;
    outcome is for logs/tests only and is never returned to the caller."""
    ok = {"ok": True}
    email = str((body or {}).get("email") or "").strip().lower()
    if not _mail.valid_email(email):
        return 400, {"error": "bad request"}, "invalid"
    if throttled(email, now):
        return 200, ok, "throttled"

    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key or not os.environ.get("NOREPLY_EMAIL_PWD"):
        return 200, ok, "not_configured"

    site_url = f"https://{host}"
    st, action_link, _, _ = _mail.generate_link("recovery", email, f"{site_url}/admin/login.html", service_key, http)
    if st != 200 or not action_link:
        return 200, ok, "no_user" if st == 404 else f"link_error_{st}"

    try:
        send(email, action_link, site_url)
    except Exception as e:  # noqa: BLE001
        return 200, ok, f"send_failed_{type(e).__name__}"
    return 200, ok, "sent"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        _mail.respond(self, 405, {"error": "POST only"})

    def do_POST(self):
        started = time.monotonic()
        status, payload, outcome = password_reset(_mail.read_json_body(self), self.headers.get("Host", ""))
        if outcome not in ("sent", "no_user", "throttled", "invalid"):
            print(json.dumps({"level": "error", "msg": "password reset not sent", "outcome": outcome}))
        remaining = MIN_RESPONSE_SECONDS - (time.monotonic() - started)
        if remaining > 0 and outcome != "invalid":
            time.sleep(remaining)
        _mail.respond(self, status, payload)
