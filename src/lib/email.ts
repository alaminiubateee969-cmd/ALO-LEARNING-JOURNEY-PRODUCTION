import nodemailer from "nodemailer";

/**
 * ALO Learning Journey — cPanel SMTP mailer
 * Uses your verified cPanel mail server:
 *   IMAP learn.aloeducation.com:993  user info@learn.aloeducation.com
 *   SMTP learn.aloeducation.com:465  user info@learn.aloeducation.com (SSL/TLS)
 *
 * Env:
 *   SMTP_HOST     default learn.aloeducation.com
 *   SMTP_PORT     default 465
 *   SMTP_SECURE   default true for 465, false for 587
 *   SMTP_USER     default info@learn.aloeducation.com
 *   SMTP_PASS     required — cPanel email password (set in cPanel → Email Accounts)
 *   SMTP_FROM     default SMTP_USER (e.g. "ALO Learning Journey <info@learn.aloeducation.com>")
 *   SMTP_REJECT_UNAUTHORIZED default true — keep true valid LE cert
 */

export type EmailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

const DEFAULTS = {
  host: "learn.aloeducation.com",
  port: 465,
  secure: true, // true for 465
  user: "info@learn.aloeducation.com",
};

export function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim() || process.env.SMTPHOST?.trim() || DEFAULTS.host;
  const portRaw = process.env.SMTP_PORT?.trim() || process.env.SMTPPORT?.trim() || String(DEFAULTS.port);
  const port = Number.parseInt(portRaw, 10) || DEFAULTS.port;
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv ? secureEnv === "true" || secureEnv === "1" : port === 465;
  const user = process.env.SMTP_USER?.trim() || process.env.SMTPUSER?.trim() || process.env.SMTP_USERNAME?.trim() || DEFAULTS.user;
  const pass = process.env.SMTP_PASS?.trim() || process.env.SMTPPASS?.trim() || process.env.SMTP_PASSWORD?.trim() || "";
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTPFROM?.trim() || `ALO Learning Journey <${user}>`;
  const rejectUnauthorized = (process.env.SMTP_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false";

  return { host, port, secure, user, pass, from, rejectUnauthorized };
}

export function isEmailConfigured(): boolean {
  const { host, user, pass } = getEmailConfig();
  return Boolean(host && user && pass);
}

export function emailDiagnostics(): { configured: boolean; host: string; port: number; secure: boolean; userMasked: string; from: string; missing: string[] } {
  const cfg = getEmailConfig();
  const missing: string[] = [];
  if (!cfg.host) missing.push("SMTP_HOST");
  if (!cfg.user) missing.push("SMTP_USER");
  if (!cfg.pass) missing.push("SMTP_PASS");
  const userMasked = cfg.user ? cfg.user.replace(/(.{2}).*(@.*)/, "$1***$2") : "(unset)";
  return { configured: missing.length === 0, host: cfg.host, port: cfg.port, secure: cfg.secure, userMasked, from: cfg.from, missing };
}

let transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  const cfg = getEmailConfig();
  if (!cfg.pass) {
    throw new Error("SMTP_PASS is not set — set it in cPanel → Application Manager → Environment Variables (value is the password you set in cPanel → Email Accounts → info@learn.aloeducation.com)");
  }
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: cfg.rejectUnauthorized },
    // keep cPanel shared-hosting friendly: short timeout, no pooling
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
  return transporter;
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true, message: "SMTP connection verified" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: msg.slice(0, 600) };
  }
}

export async function sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
  const cfg = getEmailConfig();
  const t = getTransporter();
  const info = await t.sendMail({
    from: options.from || cfg.from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
  return { messageId: info.messageId || "" };
}

// Convenience helpers -------------------------------------------------------

export async function sendTestEmail(to: string) {
  return sendEmail({
    to,
    subject: "✅ ALO Learning Journey — SMTP test from learn.aloeducation.com",
    text: `Your cPanel SMTP for info@learn.aloeducation.com is working.

Server: learn.aloeducation.com:465 (SSL)
User: ${getEmailConfig().user}
Time: ${new Date().toISOString()}
Site: https://learn.aloeducation.com — https://www.facebook.com/ALOLearningJourney — 01805-020103

If you received this, outbound mail is correctly configured.`,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height:1.6; max-width:600px; margin:auto; border:1px solid #eee; border-radius:12px; padding:24px">
        <h2 style="margin:0 0 8px 0; color:#d97706">✅ ALO Learning Journey — SMTP OK</h2>
        <p style="color:#444">Your cPanel SMTP for <b>info@learn.aloeducation.com</b> is working.</p>
        <table style="font-size:13px; color:#555; border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0; color:#888">Server</td><td><code>learn.aloeducation.com:465 (SSL)</code></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#888">User</td><td>${getEmailConfig().user}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#888">Time</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p style="margin-top:16px; font-size:13px; color:#666">Site: <a href="https://learn.aloeducation.com">learn.aloeducation.com</a> · <a href="https://www.facebook.com/ALOLearningJourney">Facebook</a> · 01805-020103</p>
        <p style="font-size:12px; color:#999">If you received this, outbound mail is correctly configured.</p>
      </div>
    `,
  });
}

export async function sendContactNotification(params: { name: string; email: string; phone?: string; message: string; topic?: string }) {
  const adminTo = process.env.CONTACT_NOTIFY_TO?.trim() || process.env.ADMIN_EMAIL?.trim() || getEmailConfig().user;
  const subject = `📩 New enquiry: ${params.topic || params.name} — ${params.name}`;
  const text = `New contact enquiry from learn.aloeducation.com

Name: ${params.name}
Email: ${params.email}
Phone: ${params.phone || "-"}
Topic: ${params.topic || "-"}
Time: ${new Date().toISOString()}

Message:
${params.message}

---
Reply to: ${params.email}
Admin: https://learn.aloeducation.com
Facebook: https://www.facebook.com/ALOLearningJourney  |  Phone: 01805-020103`;

  return sendEmail({
    to: adminTo,
    replyTo: params.email,
    subject,
    text,
    html: `
      <div style="font-family:system-ui,sans-serif; max-width:640px; margin:auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden">
        <div style="background: linear-gradient(135deg,#f59e0b,#ec4899); padding:16px 20px; color:white">
          <h2 style="margin:0; font-size:16px">📩 New enquiry — ALO Learning Journey</h2>
          <p style="margin:4px 0 0 0; font-size:12px; opacity:.9">${new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })} (Asia/Dhaka)</p>
        </div>
        <div style="padding:20px; font-size:14px; color:#334155">
          <table style="width:100%; border-collapse:collapse; font-size:13px">
            <tr><td style="padding:6px 0; color:#64748b; width:100px">Name</td><td><b>${escapeHtml(params.name)}</b></td></tr>
            <tr><td style="padding:6px 0; color:#64748b">Email</td><td><a href="mailto:${escapeHtml(params.email)}">${escapeHtml(params.email)}</a></td></tr>
            <tr><td style="padding:6px 0; color:#64748b">Phone</td><td>${escapeHtml(params.phone || "—")}</td></tr>
            <tr><td style="padding:6px 0; color:#64748b">Topic</td><td>${escapeHtml(params.topic || "—")}</td></tr>
          </table>
          <div style="margin-top:16px; padding:12px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; white-space:pre-wrap; font-size:13px; line-height:1.6">${escapeHtml(params.message)}</div>
          <p style="margin-top:16px; font-size:12px; color:#94a3b8">Reply directly to this email to respond to ${escapeHtml(params.name)}. View in admin: <a href="https://learn.aloeducation.com">learn.aloeducation.com</a></p>
        </div>
        <div style="background:#f8fafc; padding:12px 20px; font-size:11px; color:#94a3b8; text-align:center">
          ALO Learning Journey · learn.aloeducation.com · <a href="https://www.facebook.com/ALOLearningJourney">Facebook</a> · 01805-020103<br/>This is an automated notification — do not mark as spam.
        </div>
      </div>
    `,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}
