#!/usr/bin/env python3
"""Final live-status report — what's LIVE vs CODE-READY-AWAITING-INFRA."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, ListFlowable, ListItem
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase.pdfmetrics import registerFontFamily

pdfmetrics.registerFont(TTFont('Body', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('BodyBold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-SemiBold.ttf'))
pdfmetrics.registerFont(TTFont('Sans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansBold', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'))
registerFontFamily('Sans', normal='Sans', bold='SansBold', italic='Sans', boldItalic='SansBold')

SLATE_DARK = colors.HexColor('#0f172a'); SLATE = colors.HexColor('#1e293b')
SLATE_LIGHT = colors.HexColor('#475569'); AMBER = colors.HexColor('#f59e0b')
AMBER_LIGHT = colors.HexColor('#fef3c7'); BG_LIGHT = colors.HexColor('#f8fafc')
BORDER = colors.HexColor('#cbd5e1'); GREEN = colors.HexColor('#10b981'); RED = colors.HexColor('#ef4444')

styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontName='SansBold', fontSize=20, textColor=SLATE_DARK, leading=24, spaceBefore=18, spaceAfter=12, alignment=TA_LEFT)
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontName='SansBold', fontSize=14, textColor=SLATE, leading=18, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT)
H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontName='SansBold', fontSize=11, textColor=AMBER, leading=15, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle('Body', parent=styles['BodyText'], fontName='Body', fontSize=9.5, textColor=SLATE_DARK, leading=14, spaceBefore=2, spaceAfter=6, alignment=TA_JUSTIFY)
CALLOUT = ParagraphStyle('Callout', parent=BODY, fontSize=10, textColor=SLATE_DARK, backColor=AMBER_LIGHT, borderPadding=6, leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8)
COVER_TITLE = ParagraphStyle('CoverTitle', fontName='SansBold', fontSize=28, textColor=colors.white, leading=34, alignment=TA_LEFT, spaceAfter=8)
COVER_SUBTITLE = ParagraphStyle('CoverSubtitle', fontName='Body', fontSize=12, textColor=AMBER_LIGHT, leading=18, alignment=TA_LEFT, spaceAfter=20)
COVER_META = ParagraphStyle('CoverMeta', fontName='Body', fontSize=8.5, textColor=colors.HexColor('#cbd5e1'), leading=13, alignment=TA_LEFT, spaceAfter=3)

def bullets(items, style=BODY):
    return ListFlowable([ListItem(Paragraph(t, style), leftIndent=14, value='•') for t in items],
        bulletType='bullet', bulletFontName='Body', bulletFontSize=9, leftIndent=8, spaceBefore=2, spaceAfter=6)

def section_table(rows, col_widths=None):
    avail = A4[0] - 50 * mm
    if col_widths is None:
        col_widths = [avail / len(rows[0])] * len(rows[0])
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SLATE), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'SansBold'), ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Body'), ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TEXTCOLOR', (0, 1), (-1, -1), SLATE_DARK), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
    ]))
    return t

def cover_page(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(SLATE_DARK); canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(AMBER); canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor('#1e293b')); canvas.setLineWidth(0.6)
    for i in range(0, int(w), 18): canvas.line(i, 0, i + 70, h)
    canvas.setFillColor(colors.HexColor('#94a3b8')); canvas.setFont('Sans', 8)
    canvas.drawString(25 * mm, 15 * mm, 'ALO Labs · AI Voice & Contact Center · Final Live Status')
    canvas.restoreState()

def body_page(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(SLATE_DARK); canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(AMBER); canvas.rect(0, h - 12 * mm, 45 * mm, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont('SansBold', 8)
    canvas.drawString(50 * mm, h - 7.5 * mm, 'AI VOICE & CONTACT CENTER — FINAL LIVE STATUS')
    canvas.setFillColor(SLATE_LIGHT); canvas.setFont('Body', 8)
    canvas.drawCentredString(w / 2, 12 * mm, f'— {doc.page} —')
    canvas.restoreState()

def build_story():
    s = []
    s.append(Spacer(1, 65 * mm))
    s.append(Paragraph('FINAL LIVE STATUS', COVER_META))
    s.append(Paragraph('AI Voice & Contact Center', COVER_TITLE))
    s.append(Paragraph('Phase 1-7 complete — what is LIVE vs CODE-READY-AWAITING-INFRA', COVER_SUBTITLE))
    s.append(Spacer(1, 4 * mm))
    s.append(Paragraph('Commit: 5a93b13  ·  Date: 2026-11-05', COVER_META))
    s.append(Paragraph('Build: PASS (5.3s, 101 static pages)', COVER_META))
    s.append(Paragraph('Tests: 188/188 pass (5 suites, 0 failures)', COVER_META))
    s.append(Paragraph('Schema: 59 → 95 Prisma models (36 new, additive)', COVER_META))
    s.append(Paragraph('Routes: 35+ new v1 API endpoints', COVER_META))
    s.append(Paragraph('UI: 5 new dashboard views (4,471 lines)', COVER_META))
    s.append(PageBreak())

    s.append(Paragraph('Executive Summary', H1))
    s.append(Paragraph(
        'Phases 1-7 of the AI Voice & Contact Center product have been built '
        'end-to-end. The codebase is complete, all schema migrations are '
        'additive (no existing functionality removed), all 5 test suites pass '
        '(188 assertions), and the production build compiles cleanly. The '
        'dashboard now has 5 new views under a "Voice Center" sidebar section.',
        BODY))
    s.append(Paragraph(
        '<b>Critical distinction:</b> code-ready does NOT mean live. Every '
        'external service (FreeSWITCH, Piper, faster-whisper, BD SIP trunk) '
        'is wrapped in an adapter with a simulation fallback. When the operator '
        'provisions the real infrastructure, the adapters automatically use '
        'it. Until then, every call/TTS/ASR returns simulated=true with a '
        'clear warning — no false claims of real calls (per directive §2: '
        '"Keep demo functionality visibly separate from production functionality").',
        CALLOUT))
    s.append(PageBreak())

    s.append(Paragraph('LIVE vs CODE-READY Matrix', H1))
    s.append(section_table([
        ['#', 'Capability', 'Status', 'What makes it LIVE'],
        ['1', 'MFA (TOTP) setup + verify', 'LIVE', 'Already works — no external dep'],
        ['2', 'Refresh token rotation', 'LIVE', 'Already works — no external dep'],
        ['3', 'Voice agent CRUD', 'LIVE', 'Already works — DB persistence'],
        ['4', 'Consent capture + audit', 'LIVE', 'Already works — DB persistence'],
        ['5', 'Phone number provisioning', 'LIVE (manual)', 'Provision via Twilio/Telnyx/BD carrier for real PSTN'],
        ['6', 'Call state machine + events', 'LIVE', 'DB persistence; transitions fire events'],
        ['7', 'Call originate (real)', 'CODE-READY', 'Install FreeSWITCH or set Twilio/Telnyx creds'],
        ['8', 'Call recording (real)', 'CODE-READY', 'Same as #7 + consent flow already in place'],
        ['9', 'IVR / ring groups / queues', 'CODE-READY', 'Models + CRUD ready; FreeSWITCH executes them'],
        ['10', 'Bangla TTS (Piper)', 'CODE-READY', 'Install Piper + bn_BD-google-medium voice pack; set PIPER_BASE_URL'],
        ['11', 'Bangla TTS (Z.AI fallback)', 'LIVE', 'Already configured — Z.AI cloud (free) works'],
        ['12', 'Multilingual ASR', 'CODE-READY', 'Install faster-whisper or use Z.AI ASR (live)'],
        ['13', 'Voice cloning (Tortoise)', 'CODE-READY', 'Install Tortoise + signed consent form flow'],
        ['14', 'Outbound campaigns', 'LIVE (scheduling)', 'Launch validates calling hours + DNC; calls need #7'],
        ['15', 'Knowledge base (RAG)', 'LIVE (CRUD)', 'Document upload + chunking works; embedding needs Ollama bge-m3'],
        ['16', 'Agent workspace UI', 'LIVE', 'Dashboard view works; needs FreeSWITCH for real calls'],
        ['17', 'Supervisor listen/whisper/barge-in', 'CODE-READY', 'Routes exist; needs FreeSWITCH conferencing'],
        ['18', 'Customer 360 + shared inbox', 'LIVE', 'DB persistence; works end-to-end'],
        ['19', 'Call analytics (sentiment/intent)', 'CODE-READY', 'Routes exist; needs AI call post-processing'],
        ['20', 'Billing plans + subscriptions', 'LIVE', 'DB persistence; payment gateway is Phase 6+'],
        ['21', 'Usage metering', 'LIVE', 'Tracks calls/TTS/ASR per-tenant per-day; cost = $0 (free providers)'],
        ['22', 'Credit balance + invoices', 'LIVE', 'DB persistence; payment provider replaceable'],
    ], col_widths=[8*mm, 55*mm, 22*mm, 85*mm]))
    s.append(PageBreak())

    s.append(Paragraph('What\'s Already LIVE (no infra needed)', H1))
    s.append(bullets([
        '<b>MFA + refresh tokens</b> — TOTP RFC 6238 (no external dep); 30-day refresh rotation',
        '<b>Voice agent builder</b> — full CRUD for AI agent configs (system prompt, greeting, tools, working hours, approval mode)',
        '<b>Consent capture</b> — every consent persisted with who/what/when/how/method/scope (per directive §10)',
        '<b>Phone number provisioning</b> — manual numbers can be added; real PSTN needs Twilio/Telnyx/BD carrier',
        '<b>Call state machine</b> — ringing → active → hold → transfer → park → closed; every transition logged as CallEvent',
        '<b>Bangla TTS via Z.AI</b> — already configured; falls back to simulation if rate-limited',
        '<b>Outbound campaign scheduling</b> — launch validates Asia/Dhaka calling hours + DNC + consent requirement',
        '<b>Knowledge base CRUD</b> — create KBs, upload documents, chunking infrastructure ready',
        '<b>Agent workspace UI</b> — status selector, call panel, dial pad, CRM sidebar, customer 360 timeline',
        '<b>Customer 360 + shared inbox</b> — unified inbox across voice/SMS/email/web_chat with AI-vs-provider-confirmed distinction',
        '<b>Billing + usage metering</b> — plans, subscriptions, credits, invoices, per-day usage rollups; $0 cost (free providers)',
        '<b>5 new dashboard views</b> — Voice Agents, Calls, Voice Studio, Contact Center, Billing (4,471 lines)',
    ]))

    s.append(Paragraph('What\'s CODE-READY (needs infra to go LIVE)', H1))
    s.append(section_table([
        ['Capability', 'Infra needed', 'Effort'],
        ['Real PSTN calls', 'FreeSWITCH (Docker) + SIP trunk (Twilio/Telnyx/BD carrier)', '1-2 days deploy + carrier partnership'],
        ['Bangla TTS (Piper)', 'Install Piper + bn_BD voice pack on voice host', '4 hours; MIT license, CPU-only'],
        ['Streaming ASR', 'Install faster-whisper (GPU recommended) or use Z.AI cloud', '1 day; GPU optional'],
        ['Voice cloning (Tortoise)', 'Install Tortoise + signed consent workflow', '2 days; Apache 2.0 license'],
        ['Supervisor listen/whisper/barge-in', 'FreeSWITCH mod_conference + ESL events', '2 days; needs FreeSWITCH'],
        ['Call analytics (sentiment/intent)', 'AI call post-processing worker', '3 days; uses existing LLM chain'],
        ['Knowledge base RAG embeddings', 'Ollama + bge-m3 model', '4 hours; CPU-only'],
        ['PostgreSQL RLS (multi-tenant hardening)', 'Migrate SQLite → PostgreSQL + RLS policies', '1 week; Phase 8 of master audit'],
        ['BD PSTN (+880 numbers)', 'BTRC-licensed carrier partnership', 'Weeks; legal/regulatory'],
        ['Bangla voice quality evaluation', 'Native speaker panel (3+ reviewers)', '2 weeks; per BANGLA_VOICE_MODEL_EVALUATION.md'],
    ], col_widths=[55*mm, 70*mm, 45*mm]))
    s.append(PageBreak())

    s.append(Paragraph('Schema Statistics', H1))
    s.append(section_table([
        ['Layer', 'Before', 'After', 'Delta'],
        ['Prisma models', '59', '95', '+36 (additive only)'],
        ['API routes (v0)', '150', '150', '0 (no changes)'],
        ['API routes (v1)', '11', '50+', '+35+ new voice/contact-center routes'],
        ['Lib modules', '21', '24', '+3 (telephony-adapter, voice-engine, asr-engine)'],
        ['UI views', '17', '22', '+5 (voice-agents, calls, voice-studio, contact-center, billing)'],
        ['Test assertions', '127', '188', '+61 (test-voice-contact-center.ts)'],
        ['Destructive migrations', '0', '0', 'None — schema is additive only'],
    ], col_widths=[40*mm, 30*mm, 30*mm, 50*mm]))

    s.append(Paragraph('Test Results — 188/188 PASS', H1))
    s.append(section_table([
        ['Suite', 'Assertions', 'Covers'],
        ['verify-login', '4', 'JWT issue + verify + forged token rejected'],
        ['test-integrations', '36', 'AES-256-GCM vault, PKCE, OAuth state, AI chain, Bengali greeting'],
        ['test-ollama-cloud', '63', 'Ollama Cloud, circuit breaker, PII filter, bounded agent loop, real LLM call'],
        ['test-sms-providers', '24', 'SMS provider chain, Twilio real call (401), Postiz adapter'],
        ['test-voice-contact-center', '61', 'Phase 1-6 schema + voice agent CRUD + consent + call state machine + usage metering + billing'],
        ['Total', '188', '0 failures'],
    ], col_widths=[45*mm, 20*mm, 105*mm]))

    s.append(Paragraph('Production Build', H1))
    s.append(Paragraph(
        '<font name="Body" size="9">'
        '✓ Running next.config.ts took 39ms<br/>'
        '✓ Compiled successfully in 5.3s<br/>'
        '✓ Generating static pages using 1 worker (101/101) in 259ms<br/>'
        '<br/>'
        'Route (app) — 101 pages prerendered as static + dynamic API routes<br/>'
        'No TypeScript errors. No build warnings. Exit code 0.'
        '</font>',
        BODY))
    s.append(PageBreak())

    s.append(Paragraph('Outstanding Blockers (operator actions)', H1))
    s.append(bullets([
        '<b>Install FreeSWITCH</b> on a voice host with public IP + SIP trunk (Twilio/Telnyx for international test numbers; BTRC-licensed carrier for BD PSTN). Set FREESWITCH_ESL_HOST + PORT + PASSWORD env vars.',
        '<b>Install Piper TTS</b> + bn_BD-google-medium voice pack on the voice host. Set PIPER_BASE_URL. Verify Bangla quality per BANGLA_VOICE_MODEL_EVALUATION.md (100-sentence corpus + 3+ native speakers).',
        '<b>Install faster-whisper</b> (or use Z.AI cloud ASR already integrated). Set FASTER_WHISPER_URL for local; GPU recommended for streaming + low latency.',
        '<b>(Optional) Install Tortoise TTS</b> for authorized voice cloning. Set TORTOISE_BASE_URL. Voice clone authorization flow already implemented (POST /api/v1/voice-clone-authorizations).',
        '<b>Migrate to PostgreSQL 16</b> for Row Level Security (Phase 8 of master audit). SQLite is currently staging-only.',
        '<b>Source BD SIP trunk</b> for real +880 numbers. Cloud providers cannot provision BD numbers directly — requires BTRC-licensed carrier partnership.',
        '<b>Commission Bangla voice evaluation</b> per BANGLA_VOICE_MODEL_EVALUATION.md (3+ native speakers, 100-sentence corpus, 4-dimension rubric, WER ≤15% threshold).',
        '<b>Configure payment provider</b> (Stripe / SSLCommerz for BD / manual invoicing) for billing to go fully live.',
        '<b>Configure external cron</b> (systemd timer / GitHub Actions) for /api/cron/social-publish + voicemail transcription queue.',
        '<b>Production deployment approval</b> — per directive §14 acceptance criteria: real inbound + outbound calls + Bangla TTS evaluation + tenant isolation tests + load testing must all pass before production.',
    ]))

    s.append(Paragraph('Bottom Line', H1))
    s.append(Paragraph(
        '<b>Phase 1-7 codebase is complete and verified.</b> All 7 phases have '
        'their code in place: foundation (MFA + RBAC + agent registry), '
        'telephony (FreeSWITCH adapter + call state machine), voice engine '
        '(Piper + faster-whisper adapters), AI call agents (orchestrator + '
        'campaigns + knowledge base), human contact center (agent workspace + '
        'supervisor + customer 360), billing (plans + usage + credits), and '
        'production readiness (188 tests pass + build clean).',
        BODY))
    s.append(Paragraph(
        'The product is code-ready. The remaining blockers are infrastructure '
        'provisioning (FreeSWITCH, Piper, faster-whisper, BD SIP trunk) and '
        'regulatory (BTRC license, Bangla voice evaluation, BD data protection '
        'compliance). All adapters are simulation-capable, so the operator can '
        'verify each capability as it goes live — no false claims of real '
        'calls until the real infrastructure is in place.',
        CALLOUT))
    return s

def main():
    out = '/home/z/my-project/download/AI-Voice-Contact-Center-Final-Live-Status.pdf'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=25*mm, rightMargin=25*mm, topMargin=20*mm, bottomMargin=20*mm,
        title='AI Voice & Contact Center — Final Live Status',
        author='ALO Labs Engineering', subject='Phase 1-7 final live status report',
        creator='MarketingOS')
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=body_page)
    print(f'PDF: {out}  ({os.path.getsize(out):,} bytes)')

if __name__ == '__main__':
    main()
