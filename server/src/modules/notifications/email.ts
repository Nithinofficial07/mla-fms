import nodemailer, { type Transporter } from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface EmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export const emailConfigured = () =>
  (env.EMAIL_PROVIDER === 'smtp' && !!env.SMTP_HOST) ||
  (env.EMAIL_PROVIDER === 'ses' && !!(env.AWS_SES_REGION || env.AWS_REGION) && !!(env.SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID));

function recipientsOf(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && /.+@.+\..+/.test(s));
}

/* --------------------------------- SMTP --------------------------------- */
let transporter: Transporter | null = null;
function smtpTransport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    requireTLS: !(env.SMTP_SECURE || env.SMTP_PORT === 465),
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/* --------------------------------- SES ---------------------------------- */
let ses: SESv2Client | null = null;
function sesClient(): SESv2Client {
  ses ??= new SESv2Client({
    region: env.AWS_SES_REGION || env.AWS_REGION,
    credentials:
      (env.SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID)
        ? {
            accessKeyId: (env.SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID)!,
            secretAccessKey: (env.SES_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)!,
          }
        : undefined,
  });
  return ses;
}

/* ------------------------------- send core ------------------------------ */
async function deliver(to: string[], input: EmailInput): Promise<{ ok: boolean; detail: string }> {
  if (env.EMAIL_PROVIDER === 'ses') {
    try {
      const out = await sesClient().send(
        new SendEmailCommand({
          FromEmailAddress: env.EMAIL_FROM,
          Destination: { ToAddresses: to },
          Content: {
            Simple: {
              Subject: { Data: input.subject },
              Body: {
                ...(input.text ? { Text: { Data: input.text } } : {}),
                ...(input.html ? { Html: { Data: input.html } } : {}),
              },
            },
          },
        }),
      );
      return { ok: true, detail: `SES sent to ${to.join(', ')} (id ${out.MessageId})` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
    }
  }

  // smtp
  try {
    const info = await smtpTransport().sendMail({
      from: env.EMAIL_FROM,
      to: to.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, detail: `SMTP sent to ${to.join(', ')} (id ${info.messageId})` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fire-and-forget. Never throws into the request path; logs the message when
 * email isn't configured so flows keep working undeployed.
 */
export function queueEmail(input: EmailInput): void {
  const to = recipientsOf(input.to);
  if (!to.length) return;
  if (!emailConfigured()) {
    logger.info({ to, subject: input.subject }, 'email (not sent - provider disabled)');
    return;
  }
  deliver(to, input)
    .then((r) => (r.ok ? logger.info({ to }, r.detail) : logger.error({ to, subject: input.subject }, r.detail)))
    .catch((err) => logger.error({ err, to }, 'email send crashed'));
}

/** Awaitable send that reports the outcome - used by the "send test email" action. */
export async function sendEmailNow(input: EmailInput): Promise<{ ok: boolean; detail: string }> {
  const to = recipientsOf(input.to);
  if (!to.length) return { ok: false, detail: 'No valid recipient address on your account' };
  if (!emailConfigured()) {
    return { ok: false, detail: 'Email is disabled - set EMAIL_PROVIDER (smtp or ses) and its settings on the server' };
  }
  return deliver(to, input);
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
