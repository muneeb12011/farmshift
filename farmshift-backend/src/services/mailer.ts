import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** 'smtp' delivers; 'log' only writes the message to the server log (development); 'none' drops it (production without SMTP). */
  readonly kind: 'smtp' | 'log' | 'none';
  send(mail: Mail): Promise<void>;
}

export class SmtpMailer implements Mailer {
  readonly kind = 'smtp' as const;
  constructor(
    private transport: Transporter,
    private from: string,
  ) {}
  async send(m: Mail) {
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
  }
}

/** Development fallback: prints the message (including the reset link) instead of sending it. */
export class LogMailer implements Mailer {
  readonly kind = 'log' as const;
  constructor(private log: { warn: (o: object | string, m?: string) => void }) {}
  async send(m: Mail) {
    this.log.warn({ to: m.to, subject: m.subject, body: m.text }, 'EMAIL (not sent: SMTP_URL is not configured)');
  }
}

export class NullMailer implements Mailer {
  readonly kind = 'none' as const;
  constructor(private log: { error: (o: object | string, m?: string) => void }) {}
  async send(m: Mail) {
    this.log.error({ to: m.to, subject: m.subject }, 'EMAIL DROPPED: SMTP_URL is not configured in production, so password-reset emails cannot be delivered');
  }
}

export function createMailer(env: Env, log: { warn: (o: object | string, m?: string) => void; error: (o: object | string, m?: string) => void }): Mailer {
  if (env.SMTP_URL) return new SmtpMailer(nodemailer.createTransport(env.SMTP_URL), env.MAIL_FROM);
  return env.NODE_ENV === 'production' ? new NullMailer(log) : new LogMailer(log);
}

export function resetEmail(link: string, ttlMinutes: number, name: string): Pick<Mail, 'subject' | 'text' | 'html'> {
  const safe = name.replace(/[<>&"]/g, '');
  return {
    subject: 'Reset your FarmShift password',
    text: `Hi ${safe},\n\nSomeone asked to reset the password for your FarmShift account. If that was you, open this link within ${ttlMinutes} minutes:\n\n${link}\n\nThe link works once. If you did not ask for this, ignore this email; your password has not changed.\n`,
    html: `<p>Hi ${safe},</p><p>Someone asked to reset the password for your FarmShift account. If that was you, use this link within ${ttlMinutes} minutes:</p><p><a href="${link}">Reset my password</a></p><p>The link works once. If you did not ask for this, ignore this email; your password has not changed.</p>`,
  };
}
