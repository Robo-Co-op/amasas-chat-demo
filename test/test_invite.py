"""Unit tests for api/admin/invite.py. Run: python -m unittest discover -s test -p "test_*.py" """

import importlib.util
import os
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("invite", ROOT / "api" / "admin" / "invite.py")
invite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(invite)

ENV = {"SUPABASE_SERVICE_KEY": "sb_secret_test", "NOREPLY_EMAIL_PWD": "pw"}
BODY = {"email": "new@example.org", "displayName": "New Person", "role": "editor"}


class FakeSupabase:
    def __init__(self, caller_role="owner", link_status=200, reg_status=200, shape="flat"):
        self.caller_role, self.link_status, self.reg_status, self.shape = caller_role, link_status, reg_status, shape
        self.calls = []

    def __call__(self, method, url, headers, body=None):
        self.calls.append((method, url, headers, body))
        if url.endswith("/rpc/admin_whoami"):
            return (200, {"role": self.caller_role}) if self.caller_role else (200, None)
        if url.endswith("/admin/generate_link"):
            if self.link_status != 200:
                return self.link_status, {"msg": "A user with this email address has already been registered"}
            if self.shape == "nested":
                return 200, {"user": {"id": "u-1"}, "properties": {"action_link": "https://x/verify?token=abc&type=invite"}}
            return 200, {"id": "u-1", "action_link": "https://x/verify?token=abc&type=invite"}
        if url.endswith("/rpc/admin_register_user"):
            return (200, {"id": "u-1", "role": body["new_role"]}) if self.reg_status == 200 else (400, {"message": "forbidden"})
        if method == "DELETE":
            return 200, {}
        raise AssertionError(f"unexpected call {method} {url}")

    def urls(self):
        return [(m, u.split(".co")[-1]) for m, u, _, _ in self.calls]


@mock.patch.dict(os.environ, ENV, clear=False)
class InviteTests(unittest.TestCase):
    def run_invite(self, sb, body=BODY, token="caller-jwt", send=None):
        send = send or mock.Mock()
        status, payload = invite.invite(token, body, "amasas-chat-demo-7bk6.vercel.app", http=sb, send=send)
        return status, payload, send

    def test_happy_path_registers_then_sends_email(self):
        sb = FakeSupabase()
        status, payload, send = self.run_invite(sb)
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        send.assert_called_once_with(
            "new@example.org", "https://x/verify?token=abc&type=invite", "https://amasas-chat-demo-7bk6.vercel.app"
        )
        self.assertEqual(
            sb.urls(),
            [("POST", "/rest/v1/rpc/admin_whoami"), ("POST", "/auth/v1/admin/generate_link"), ("POST", "/rest/v1/rpc/admin_register_user")],
        )
        link_call = sb.calls[1]
        self.assertEqual(link_call[2]["Authorization"], "Bearer sb_secret_test")
        self.assertEqual(link_call[3]["redirect_to"], "https://amasas-chat-demo-7bk6.vercel.app/admin/login.html")
        # registration uses the caller's own token, not the service key
        self.assertEqual(sb.calls[2][2]["Authorization"], "Bearer caller-jwt")

    def test_nested_generate_link_shape(self):
        status, _, send = self.run_invite(FakeSupabase(shape="nested"))
        self.assertEqual(status, 200)
        send.assert_called_once()

    def test_smtp_failure_rolls_back_user(self):
        sb = FakeSupabase()
        status, payload, _ = self.run_invite(sb, send=mock.Mock(side_effect=OSError("smtp down")))
        self.assertEqual(status, 502)
        self.assertIn("SMTP", payload["error"])
        self.assertEqual(sb.urls()[-1], ("DELETE", "/auth/v1/admin/users/u-1"))

    def test_register_failure_rolls_back_and_sends_nothing(self):
        sb = FakeSupabase(reg_status=400)
        status, _, send = self.run_invite(sb)
        self.assertEqual(status, 502)
        send.assert_not_called()
        self.assertEqual(sb.urls()[-1], ("DELETE", "/auth/v1/admin/users/u-1"))

    def test_existing_user_error_passes_through(self):
        status, payload, send = self.run_invite(FakeSupabase(link_status=422))
        self.assertEqual(status, 502)
        self.assertIn("already been registered", payload["error"])
        send.assert_not_called()

    def test_permissions(self):
        for caller, role, expected in [("viewer", "viewer", 403), ("editor", "viewer", 403), (None, "viewer", 403),
                                       ("admin", "owner", 403), ("admin", "admin", 403), ("admin", "editor", 200)]:
            with self.subTest(caller=caller, role=role):
                status, _, _ = self.run_invite(FakeSupabase(caller_role=caller), body={**BODY, "role": role})
                self.assertEqual(status, expected)

    def test_bad_input(self):
        self.assertEqual(self.run_invite(FakeSupabase(), token="")[0], 401)
        self.assertEqual(self.run_invite(FakeSupabase(), body={**BODY, "role": "god"})[0], 400)
        self.assertEqual(self.run_invite(FakeSupabase(), body={**BODY, "email": "a@b.c\r\nBcc: x@y.z"})[0], 400)
        self.assertEqual(self.run_invite(FakeSupabase(), body=None)[0], 400)

    def test_missing_smtp_password(self):
        with mock.patch.dict(os.environ, {"NOREPLY_EMAIL_PWD": ""}):
            status, payload, _ = self.run_invite(FakeSupabase())
        self.assertEqual(status, 500)
        self.assertIn("NOREPLY_EMAIL_PWD", payload["error"])

    def test_email_message_built_and_sent_over_ssl(self):
        smtp = mock.MagicMock()
        with mock.patch.object(invite.smtplib, "SMTP_SSL", return_value=smtp) as ssl_cls:
            invite.send_invite_email("new@example.org", "https://x/verify?a=1&b=2", "https://site")
        ssl_cls.assert_called_once()
        self.assertEqual(ssl_cls.call_args[0][:2], ("smtp.hostinger.com", 465))
        conn = smtp.__enter__.return_value
        conn.login.assert_called_once_with("noreply@robocoop.org", "pw")
        msg = conn.send_message.call_args[0][0]
        self.assertEqual(msg["To"], "new@example.org")
        self.assertIn("noreply@robocoop.org", msg["From"])
        html_part = msg.get_body(preferencelist=("html",)).get_content()
        self.assertIn('href="https://x/verify?a=1&amp;b=2"', html_part)
        self.assertNotIn("{{", html_part)
        self.assertNotIn("Paste this into", html_part)
        self.assertIn("https://x/verify?a=1&b=2", msg.get_body(preferencelist=("plain",)).get_content())


if __name__ == "__main__":
    unittest.main()
