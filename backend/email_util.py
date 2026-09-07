import os
import re
import ipaddress
import logging
import httpx
from html.parser import HTMLParser
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()
logger = logging.getLogger("tk_email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "TK SafetyGuard")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def otp_email_html(code: str) -> str:
    return (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#111">'
        '<p style="font-size:12px;letter-spacing:2px;color:#71717A">TK SAFETYGUARD — ADMIN ACCESS</p>'
        '<p>Your one-time admin access code is:</p>'
        f'<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{code}</p>'
        '<p>This code expires in 10 minutes. If you did not request admin access, ignore this email.</p>'
        '<p style="font-size:12px;color:#888">Sent by TK SafetyGuard. We never ask for your password by email.</p>'
        '</td></tr></table>'
    )


def reset_email_html(code: str) -> str:
    return (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#111">'
        '<p style="font-size:12px;letter-spacing:2px;color:#71717A">TK SAFETYGUARD — PASSWORD RESET</p>'
        '<p>Use this code to reset your password:</p>'
        f'<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{code}</p>'
        '<p>This code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>'
        '<p style="font-size:12px;color:#888">Sent by TK SafetyGuard. We never ask for your password by email.</p>'
        '</td></tr></table>'
    )


# ---------------------------------------------------------------------------
# Assessment report email (server-side template — callers pass an ID, never markup)
# ---------------------------------------------------------------------------
from html import escape as _esc

_MODE_NAMES = {
    "risk": "Live Risk Assessment",
    "swms": "Safe Work Method Statement (SWMS)",
    "density": "Worker Density Assessment",
    "machinery": "Machinery Safety Assessment",
}


def _risk_hex(level: str) -> str:
    return {
        "low": "#16A34A", "medium": "#F59E0B", "high": "#DC2626", "critical": "#7F1D1D",
    }.get((level or "").lower(), "#71717A")


def _fmt_date(iso: str) -> str:
    try:
        from datetime import datetime as _dt
        return _dt.fromisoformat(str(iso).replace("Z", "+00:00")).strftime("%d %b %Y, %I:%M %p")
    except Exception:
        return str(iso or "")


def assessment_report_html(a: dict) -> str:
    """Render a stored assessment as an inline-CSS, table-based email report.
    No <form>/<input>, no external anchors (source URLs shown as plain text)."""
    r = a.get("result") or {}
    mode_name = _MODE_NAMES.get(a.get("mode"), "Safety Assessment")
    overall = r.get("overall_risk_level") or "N/A"
    approved = a.get("status") == "approved"

    hazards = ""
    for h in (r.get("hazards") or []):
        controls = "<br/>".join(f"• {_esc(str(c))}" for c in (h.get("controls") or []))
        hazards += (
            "<tr>"
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(h.get("hazard",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;text-align:center;vertical-align:top">'
            f'<span style="background:{_risk_hex(h.get("risk_level"))};color:#fff;padding:2px 8px;font-size:11px">{_esc(h.get("risk_level",""))}</span></td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(h.get("likelihood",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(h.get("consequence",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{controls}</td>'
            "</tr>"
        )
    hazard_table = (
        '<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Hazard &amp; Risk Register</h2>'
        '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        '<tr><th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Hazard</th>'
        '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px">Risk</th>'
        '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Likelihood</th>'
        '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Consequence</th>'
        '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Controls</th></tr>'
        f'{hazards}</table>'
    ) if hazards else ""

    swms = ""
    if (r.get("swms_steps") or []):
        rows = "".join(
            "<tr>"
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(s.get("step",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(s.get("hazards",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(s.get("controls",""))}</td>'
            f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(s.get("ppe",""))}</td>'
            "</tr>"
            for s in r["swms_steps"]
        )
        swms = (
            '<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">SWMS — Task Steps</h2>'
            '<table style="width:100%;border-collapse:collapse;font-size:12px">'
            '<tr><th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Step</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Hazards</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Controls</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">PPE</th></tr>'
            f'{rows}</table>'
        )

    density = ""
    d = r.get("density")
    if d:
        density = (
            '<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Worker Density</h2>'
            f'<p style="font-size:13px"><b>People counted:</b> {_esc(str(d.get("people_count","")))} &nbsp;|&nbsp; '
            f'<b>Rating:</b> <span style="background:{_risk_hex(d.get("density_rating"))};color:#fff;padding:2px 8px;font-size:11px">{_esc(d.get("density_rating",""))}</span></p>'
            f'<p style="font-size:13px"><b>Area:</b> {_esc(d.get("area_note",""))}</p>'
            f'<p style="font-size:13px"><b>Recommendation:</b> {_esc(d.get("recommendation",""))}</p>'
        )

    machinery = ""
    m = r.get("machinery")
    if m:
        outcome = str(a.get("equipment_outcome") or m.get("outcome") or "").upper()
        banner = ""
        if outcome in ("PASS", "HAZARD"):
            bg = "#16A34A" if outcome == "PASS" else "#DC2626"
            tail = " — SAFE TO OPERATE" if outcome == "PASS" else " — DO NOT OPERATE"
            banner = f'<div style="background:{bg};color:#fff;padding:8px 12px;font-weight:bold;font-size:12px;margin:10px 0">OUTCOME: {outcome}{tail}</div>'
        equip = " ".join(x for x in [m.get("brand"), m.get("model")] if x and x != "Unknown") or m.get("machine_type", "")
        specs = ""
        for sc in (m.get("spec_checks") or []):
            passed = str(sc.get("status", "")).lower() == "pass"
            specs += (
                "<tr>"
                f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(sc.get("item",""))}</td>'
                f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(sc.get("requirement",""))}</td>'
                f'<td style="border:1px solid #999;padding:6px;vertical-align:top">{_esc(sc.get("observed",""))}</td>'
                f'<td style="border:1px solid #999;padding:6px;text-align:center;vertical-align:top">'
                f'<span style="background:{"#16A34A" if passed else "#DC2626"};color:#fff;padding:2px 8px;font-size:11px">{_esc(sc.get("status",""))}</span></td>'
                "</tr>"
            )
        spec_table = (
            '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">'
            '<tr><th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Item</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Requirement</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px;text-align:left">Observed</th>'
            '<th style="background:#111;color:#fff;border:1px solid #999;padding:6px">Status</th></tr>'
            f'{specs}</table>'
        ) if specs else ""
        sources = ""
        if (r.get("manual_sources") or []):
            items = "".join(f'<li>{_esc(sc.get("title") or sc.get("url",""))} — {_esc(sc.get("url",""))}</li>' for sc in r["manual_sources"])
            sources = f'<p style="font-size:13px;margin-top:8px"><b>Live manual sources:</b></p><ul style="font-size:12px">{items}</ul>'
        machinery = (
            '<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Machinery Safety &amp; Equipment</h2>'
            f'{banner}'
            f'<p style="font-size:13px"><b>Equipment:</b> {_esc(equip)} ({_esc(m.get("machine_type",""))})</p>'
            + (f'<p style="font-size:13px"><b>Plate / Serial:</b> {_esc(m.get("identifiers",""))}</p>' if m.get("identifiers") else "")
            + (f'<p style="font-size:13px"><b>Manual / Standard:</b> {_esc(m.get("manual_reference",""))}</p>' if m.get("manual_reference") else "")
            + f'<p style="font-size:13px"><b>Guarding:</b> {_esc(m.get("guarding_status",""))}</p>'
            + f'<p style="font-size:13px"><b>Isolation / LOTO:</b> {_esc(m.get("isolation_note",""))}</p>'
            + (f'<p style="font-size:13px"><b>Compliance:</b> {_esc(m.get("compliance_note",""))}</p>' if m.get("compliance_note") else "")
            + (f'<p style="font-size:13px"><b>Warranty / Insurance:</b> {_esc(m.get("warranty_insurance_note",""))}</p>' if m.get("warranty_insurance_note") else "")
            + spec_table + sources
        )

    actions = "".join(f'<li>{_esc(str(x))}</li>' for x in (r.get("recommended_actions") or []))
    actions_html = f'<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Recommended Actions</h2><ul style="font-size:13px">{actions}</ul>' if actions else ""
    refs = "".join(f'<li>{_esc(str(x))}</li>' for x in (r.get("legislation_refs") or []))
    refs_html = f'<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Legislative References</h2><ul style="font-size:12px">{refs}</ul>' if refs else ""

    status_html = (
        '<div style="background:#16A34A;color:#fff;padding:8px 12px;font-size:12px;font-weight:bold;letter-spacing:1px;margin:10px 0">'
        f'APPROVED &amp; FINALISED — {_esc(a.get("approved_by",""))} ({_esc(a.get("approved_by_role",""))})</div>'
        if approved else
        '<div style="background:#F59E0B;color:#111;padding:8px 12px;font-size:12px;font-weight:bold;letter-spacing:1px;margin:10px 0">'
        'DRAFT — PENDING SAFETY OFFICER SIGN-OFF</div>'
    )

    return (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#111">'
        '<p style="font-size:12px;letter-spacing:3px;color:#71717A">TK SAFETYGUARD — THE KITCHENARY OHS&amp;E</p>'
        f'<h1 style="font-size:22px;margin:4px 0 2px">{_esc(r.get("title") or a.get("title",""))}</h1>'
        f'<p style="color:#52525B;font-size:13px;margin:0 0 8px">{_esc(mode_name)}</p>'
        '<div style="border:2px solid #111;padding:12px;margin:12px 0;font-size:13px">'
        f'<b>Location:</b> {_esc(a.get("location") or "N/A")}<br/>'
        f'<b>Assessed by:</b> {_esc(a.get("user_name") or "N/A")}<br/>'
        f'<b>Date:</b> {_esc(_fmt_date(a.get("created_at")))}<br/>'
        f'<b>Reference:</b> {_esc(a.get("id",""))}</div>'
        f'<div style="display:inline-block;background:{_risk_hex(overall)};color:#fff;padding:6px 14px;font-weight:bold;margin:8px 0">OVERALL RISK: {_esc(overall)}</div>'
        f'{status_html}'
        '<h2 style="font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:22px">Summary</h2>'
        f'<p style="font-size:13px;line-height:1.5">{_esc(r.get("summary",""))}</p>'
        + (f'<p style="font-size:13px"><b>Field notes:</b> {_esc(a.get("notes",""))}</p>' if a.get("notes") else "")
        + hazard_table + swms + density + machinery + actions_html + refs_html
        + '<p style="margin-top:26px;font-size:11px;color:#71717A;border-top:1px solid #ccc;padding-top:8px">'
        'Sent by TK SafetyGuard. Aligned with the Work Health and Safety Act 2011. '
        'This document must be reviewed and signed off by a competent person before use. '
        'We never ask for your password by email.</p>'
        '</td></tr></table>'
    )
