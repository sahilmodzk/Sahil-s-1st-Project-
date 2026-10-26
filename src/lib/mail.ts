import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import nodemailer from 'nodemailer';

export async function sendPasswordReset(email: string, url: string) {
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      requireTLS: process.env.SMTP_SECURE !== 'true',
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'Gather <no-reply@localhost>',
      to: email,
      subject: 'Reset your Gather password',
      text: `A password reset was requested for your Gather account.\n\n${url}\n\nThis link expires in one hour. If you did not request this, ignore this message.`,
    });
    return;
  }
  // The file mailbox is a development-only delivery transport, never a public HTTP endpoint.
  if (process.env.NODE_ENV === 'production') throw new Error('SMTP_HOST is required for production password reset delivery.');
  const directory = path.join(process.cwd(), '.local', 'mail');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ to: email, subject: 'Reset your Gather password', url }, null, 2), { mode: 0o600 });
}
