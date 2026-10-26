# Email — cPanel `info@learn.aloeducation.com` (learn.aloeducation.com)

> **Verified on your host `learn.aloeducation.com` (115.187.18.53)**
> - **Incoming IMAP:** `learn.aloeducation.com:993` SSL/TLS — user `info@learn.aloeducation.com`
> - **Outgoing SMTP:** `learn.aloeducation.com:465` SSL/TLS — user `info@learn.aloeducation.com`
> - **Public contact:** `01805-020103` · `https://www.facebook.com/ALOLearningJourney` · `https://learn.aloeducation.com`

This app now sends mail via that cPanel account using [Nodemailer](https://nodemailer.com). No Gmail OAuth or third-party ESP is required.

---

## 1) cPanel — create/set the mailbox password

1. **cPanel → Email Accounts →** create/verify `info@learn.aloeducation.com` (you already have it).
2. Click **Manage → Password** → set a strong password (e.g. `openssl rand -base64 24`). Copy it — you will put it in the app below as `SMTP_PASS`. Keep it out of Git.
3. Optional: enable **Auto-responders** or **Forwarders** if you want a copy to another inbox.

> IMAP `993` / SMTP `465` use your valid Let's Encrypt cert (valid until 2027-01-12), so leave TLS verification **on**.

---

## 2) cPanel → Application Manager → Environment Variables

In your Node.js app (`/home/aloeduca/learn.aloeducation.com` → Application Manager → Environment Variables → Add):

| Variable | Value |
|---|---|
| `SMTP_HOST` | `learn.aloeducation.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `info@learn.aloeducation.com` |
| `SMTP_PASS` | *(the password from step 1 — **required**)* |
| `SMTP_FROM` | `ALO Learning Journey <info@learn.aloeducation.com>` |
| `CONTACT_NOTIFY_TO` | `info@learn.aloeducation.com` *(optional — where contact form goes; defaults to `ADMIN_EMAIL` then `SMTP_USER`)* |

**For local dev:** add the same keys to your ignored `.env` (see `.env.example` block).

After saving, click **Restart** — logs should show `SMTP ready: learn.aloeducation.com:465 as info@...` or `SMTP_PASS not set` if missing.

---

## 3) Verify

### In-app (admin only)

- **Health with email check:** `GET https://learn.aloeducation.com/api/health?details=1` (admin session required) → look for `Email (SMTP)` check.
- **Full diagnostics:** `GET https://learn.aloeducation.com/api/email/test` (admin) → shows `host`, `port`, `userMasked`, `configured`, plus `verify` result.
- **Send a test:** `POST https://learn.aloeducation.com/api/email/test` with `{"to":"you@example.com"}` (admin). It sends from `info@learn.aloeducation.com`.

### Public contact form

- **Page:** `https://learn.aloeducation.com/contact` — public, no login required, rate-limited 5/min per IP.
- **API:** `POST https://learn.aloeducation.com/api/contact` with `{ name, email, phone?, message, topic? }`.
- Every submission is also saved to `marketingLead` (`source=website-contact`) so enquiries are not lost if SMTP is down. Admin sees them in CRM.

### Mail clients (Roundcube, Gmail, Outlook, iOS)

For your own inbox or team:

| Setting | Value |
|---|---|
| IMAP server | `learn.aloeducation.com` |
| IMAP port | `993` + SSL/TLS |
| SMTP server | `learn.aloeducation.com` |
| SMTP port | `465` + SSL/TLS |
| Username | `info@learn.aloeducation.com` |
| Password | *(same `SMTP_PASS`)* |

cPanel → **Email Accounts → Connect Devices** shows the same values and an auto-config file.

---

## 4) What was added in code

- `src/lib/email.ts` — `getTransporter()`, `isEmailConfigured()`, `verifySmtpConnection()`, `sendEmail()`, `sendContactNotification()`, `sendTestEmail()`
- `src/app/api/email/test/route.ts` — admin-only diagnostics + test send
- `src/app/api/contact/route.ts` — public contact endpoint (rate-limited, audit-logged, CRM-saved)
- `src/app/contact/page.tsx` + `src/components/contact/ContactForm.tsx` — public contact page with `info@`, `01805-020103`, Facebook link
- `src/app/api/health/route.ts` — new `Email (SMTP)` check in `?details=1`
- `src/app/page.tsx` footer — now shows `info@learn.aloeducation.com · 01805-020103 · ALOLearningJourney`
- `src/components/alo/BrandSettings.tsx` — SMTP card now defaults to `learn.aloeducation.com:465` + real help text
- `src/middleware.ts` — allows `/contact` and `/api/contact` without login
- `.env.example`, `scripts/cpanel-start.mjs` — email diagnostics on boot
- `package.json` — added `nodemailer@^7.0.9`

---

## 5) Troubleshooting

- **`SMTP_PASS not set`** → app runs but `POST /api/contact` returns `202` with `warning: Contact saved — email delivery is not yet configured`. Still saves to CRM; set `SMTP_PASS` and restart.
- **`smtp_verify_failed`** → wrong password, or cPanel → Email Accounts → `info@...` is suspended/locked. Reset password and update `SMTP_PASS`.
- **`EAUTH / Invalid login`** → check `SMTP_USER` spelling (`info@learn.aloeducation.com`) and that the mailbox exists in cPanel.
- **Self-signed cert error** → keep `SMTP_REJECT_UNAUTHORIZED=true` (default) — your Let's Encrypt cert is valid. Only set `false` temporarily if you see `self signed certificate` on other hosts.
- **Rate limited 429** → contact form `5/min/IP`. Admin test endpoint has no limit but requires admin session.

---

## 6) Footer / branding everywhere

Footer now shows on both admin shell (`src/app/page.tsx`) and public contact page:

> `info@learn.aloeducation.com · 01805-020103 · [ALOLearningJourney](https://www.facebook.com/ALOLearningJourney) · learn.aloeducation.com`

To change the Facebook handle or phone globally, search-replace `ALOLearningJourney` / `01805-020103` and update this doc.
