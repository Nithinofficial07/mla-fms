import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let transporter: Transporter | null = null;
let warned = false;

function getTransport(): Transporter | null {
  if (env.EMAIL_PROVIDER !== 'smtp' || !env.SMTP_HOST) {
    if (!warned) {
      logger.info('EMAIL_PROVIDER is not "smtp" (or SMTP_HOST missing) - emails are logged, not sent');
      warned = true;
    }
    return null;
  }
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true => port 465
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface EmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export const emailConfigured = () => env.EMAIL_PROVIDER === 'smtp' && !!env.SMTP_HOST;

function recipientsOf(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && /.+@.+\..+/.test(s));
}

/**
 * Fire-and-forget email. Never throws into the request path. When email isn't
 * configured it logs the message instead of sending, so flows still work.
 */
export function queueEmail(input: EmailInput): void {
  const recipients = recipientsOf(input.to);
  if (!recipients.length) return;

  const t = getTransport();
  if (!t) {
    logger.info({ to: recipients, subject: input.subject }, 'email (not sent - provider disabled)');
    return;
  }
  t.sendMail({
    from: env.EMAIL_FROM,
    to: recipients.join(', '),
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
    .then((info) => logger.info({ to: recipients, messageId: info.messageId }, 'email sent'))
    .catch((err) => logger.error({ err, to: recipients, subject: input.subject }, 'email send failed'));
}

/**
 * Awaitable send that reports the outcome - used by the "send test email"
 * admin action so SMTP config can be verified from the UI.
 */
export async function sendEmailNow(input: EmailInput): Promise<{ ok: boolean; detail: string }> {
  const recipients = recipientsOf(input.to);
  if (!recipients.length) return { ok: false, detail: 'No valid recipient address on your account' };
  const t = getTransport();
  if (!t) {
    return { ok: false, detail: 'Email is disabled - set EMAIL_PROVIDER=smtp and SMTP_HOST on the server' };
  }
  try {
    const info = await t.sendMail({
      from: env.EMAIL_FROM,
      to: recipients.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, detail: `Sent to ${recipients.join(', ')} (id ${info.messageId})` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Minimal branded HTML wrapper for notification emails. */
export function emailLayout(title: string, bodyRows: [string, string][], ctaLabel?: string, ctaUrl?: string): string {
  const rows = bodyRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5b6472;font-size:13px;white-space:nowrap">${k}</td>` +
        `<td style="padding:6px 0;color:#1a2233;font-size:13px;font-weight:600">${v || '-'}</td></tr>`,
    )
    .join('');
  const cta =
    ctaLabel && ctaUrl
      ? `<p style="margin:20px 0 0"><a href="${ctaUrl}" style="background:#0b3d91;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;display:inline-block">${ctaLabel}</a></p>`
      : '';
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f4f6fb">
    <div style="background:#fff;border:1px solid #e3e8f2;border-radius:12px;padding:24px">
      <div style="font-weight:700;color:#0b3d91;font-size:15px;margin-bottom:4px">MLA Office</div>
      <h2 style="margin:0 0 16px;font-size:18px;color:#1a2233">${title}</h2>
      <table style="border-collapse:collapse">${rows}</table>
      ${cta}
    </div>
    <p style="color:#9aa3b2;font-size:11px;margin-top:16px">Automated message from the MLA File Management System.</p>
  </div>`;
}
