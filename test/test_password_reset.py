"""Unit tests for api/admin/password-reset.py and api/admin/_mail.py."""

import importlib.util
import os
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / "api" / "admin" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


reset = load("password_reset", "password-reset.py")
mail = reset._mail

ENV = {"SUPABASE_SERVICE_KEY": "sb_secret_test", "NOREPLY_EMAIL_PWD": "pw"}
HOST = "amasas-chat-demo-7bk6.vercel.app"


def fake_http(status=200):
    calls = []

    def http(method, url, headers, body=None):
        calls.append((method, url, headers, body))
        if status == 200:
            return 200, {"id": "u-1", "action_link": "https://x/verify?token=r&type=recovery"}
        return status, {"msg": "User not found"}

    http.calls = calls
    return http


@mock.patch.dict(os.environ, ENV, clear=False)
class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        reset._recent.clear()
        reset._last_sent.clear()

    def test_existing_user_gets_recovery_email(self):
        http, send = fake_http(), mock.Mock()
        status, payload, outcome = reset.password_reset({"email": "Admin@Example.org "}, HOST, http=http, send=send)
        self.assertEqual((status, payload, outcome), (200, {"ok": True}, "sent"))
        method, url, headers, body = http.calls[0]
        self.assertTrue(url.endswith("/auth/v1/admin/generate_link"))
        self.assertEqual(body, {"type": "recovery", "email": "admin@example.org", "redirect_to": f"https://{HOST}/admin/login.html"})
        self.assertEqual(headers["Authorization"], "Bearer sb_secret_test")
        send.assert_called_once_with("admin@example.org", "https://x/verify?token=r&type=recovery", f"https://{HOST}")

    def test_unknown_user_looks_identical_and_sends_nothing(self):
        send = mock.Mock()
        status, payload, outcome = reset.password_reset({"email": "nobody@example.org"}, HOST, http=fake_http(404), send=send)
        self.assertEqual((status, payload, outcome), (200, {"ok": True}, "no_user"))
        send.assert_not_called()

    def test_smtp_failure_still_looks_identical(self):
        status, payload, outcome = reset.password_reset(
            {"email": "a@example.org"}, HOST, http=fake_http(), send=mock.Mock(side_effect=OSError("down"))
        )
        self.assertEqual((status, payload), (200, {"ok": True}))
        self.assertEqual(outcome, "send_failed_OSError")

    def test_per_email_cooldown(self):
        send = mock.Mock()
        reset.password_reset({"email": "a@example.org"}, HOST, http=fake_http(), send=send, now=1000)
        _, payload, outcome = reset.password_reset({"email": "a@example.org"}, HOST, http=fake_http(), send=send, now=1030)
        self.assertEqual((payload, outcome), ({"ok": True}, "throttled"))
        reset.password_reset({"email": "a@example.org"}, HOST, http=fake_http(), send=send, now=1061)
        self.assertEqual(send.call_count, 2)

    def test_global_limit(self):
        send = mock.Mock()
        for i in range(reset.GLOBAL_LIMIT_PER_MIN):
            reset.password_reset({"email": f"u{i}@example.org"}, HOST, http=fake_http(), send=send, now=1000 + i)
        _, _, outcome = reset.password_reset({"email": "late@example.org"}, HOST, http=fake_http(), send=send, now=1030)
        self.assertEqual(outcome, "throttled")

    def test_invalid_email_rejected(self):
        for bad in ["", "nope", "a@b.c\r\nBcc: x@y.z"]:
            self.assertEqual(reset.password_reset({"email": bad}, HOST, http=fake_http(), send=mock.Mock())[0], 400)
        self.assertEqual(reset.password_reset(None, HOST, http=fake_http(), send=mock.Mock())[0], 400)

    def test_not_configured_does_not_leak(self):
        with mock.patch.dict(os.environ, {"NOREPLY_EMAIL_PWD": ""}):
            status, payload, outcome = reset.password_reset({"email": "a@example.org"}, HOST, http=fake_http(), send=mock.Mock())
        self.assertEqual((status, payload, outcome), (200, {"ok": True}, "not_configured"))

    def test_send_recovery_email_uses_recovery_template(self):
        with mock.patch.object(mail, "send_email") as send:
            reset.send_recovery_email("a@example.org", "https://x/l", "https://site")
        send.assert_called_once_with("recovery", "a@example.org", "https://x/l", "https://site")


@mock.patch.dict(os.environ, ENV, clear=False)
class MailTests(unittest.TestCase):
    def sent_message(self, kind):
        smtp = mock.MagicMock()
        with mock.patch.object(mail.smtplib, "SMTP_SSL", return_value=smtp) as ssl_cls:
            mail.send_email(kind, "new@example.org", "https://x/verify?a=1&b=2", "https://site")
        self.assertEqual(ssl_cls.call_args[0][:2], ("smtp.hostinger.com", 465))
        conn = smtp.__enter__.return_value
        conn.login.assert_called_once_with("noreply@robocoop.org", "pw")
        return conn.send_message.call_args[0][0]

    def test_both_kinds_render_full_templates(self):
        for kind, subject in [("invite", "AMASAS 管理者への招待"), ("recovery", "AMASAS パスワード再設定")]:
            with self.subTest(kind=kind):
                msg = self.sent_message(kind)
                self.assertEqual(msg["Subject"], subject)
                self.assertEqual(msg["To"], "new@example.org")
                self.assertIn("noreply@robocoop.org", msg["From"])
                html_part = msg.get_body(preferencelist=("html",)).get_content()
                self.assertIn('href="https://x/verify?a=1&amp;b=2"', html_part)
                self.assertNotIn("{{", html_part)
                self.assertNotIn("Paste this into", html_part)
                self.assertIn("https://x/verify?a=1&b=2", msg.get_body(preferencelist=("plain",)).get_content())

    def test_missing_password_raises(self):
        with mock.patch.dict(os.environ, {"NOREPLY_EMAIL_PWD": ""}):
            with self.assertRaises(RuntimeError):
                mail.send_email("invite", "a@example.org", "https://x", "https://site")


if __name__ == "__main__":
    unittest.main()
