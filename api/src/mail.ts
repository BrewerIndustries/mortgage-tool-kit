// Email plumbing. The Worker never sends mail itself (Cloudflare Workers can't
// open SMTP, and the Gmail sender lives on the home server behind NAT). Instead
// it drops messages into an outbox table; Jarvis polls /relay/outbox and sends
// them via its existing Gmail SMTP. See api/DEPLOY.md + the mtk-mail-relay timer.

import { uuid } from './util';
import { newToken } from './auth';

const VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000;   // links are good for 3 days

// Queue one message for Jarvis to send. `kind` is just a label for logs/metrics.
export async function enqueueEmail(
  db: D1Database,
  msg: { to: string; subject: string; body: string; kind?: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO email_outbox (id, to_email, subject, body, kind, created_at) VALUES (?,?,?,?,?,?)')
    .bind(uuid(), msg.to, msg.subject, msg.body, msg.kind ?? 'generic', Date.now())
    .run();
}

// Issue a fresh verification link for a user and queue the email. `apiBase` is
// the Worker's own origin (the /auth/verify endpoint lives on it); `siteBase` is
// the public site the user lands on afterward. Returns the token (handy in tests).
export async function issueVerification(
  db: D1Database,
  user: { id: string; email: string; display_name?: string | null },
  apiBase: string,
  siteBase: string,
): Promise<string> {
  const token = newToken();
  const created = Date.now();
  await db
    .prepare('INSERT INTO email_verifications (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(token, user.id, created, created + VERIFY_TTL_MS)
    .run();

  const link = `${apiBase}/auth/verify?token=${encodeURIComponent(token)}`;
  const hi = user.display_name ? `Hi ${user.display_name},` : 'Hi,';
  const body =
    `${hi}\n\n` +
    `Please confirm this email address for your Mortgage Tool Kit account by opening the link below:\n\n` +
    `${link}\n\n` +
    `The link expires in 3 days. If you didn't create this account, you can ignore this message.\n\n` +
    `${siteBase}\n`;

  await enqueueEmail(db, {
    to: user.email,
    subject: 'Confirm your Mortgage Tool Kit email',
    body,
    kind: 'verify',
  });
  return token;
}

const RESET_TTL_MS = 60 * 60 * 1000;   // reset links are good for 1 hour

// Issue a password-reset link and queue the email. `siteBase` is the public site;
// the SPA picks up `#reset=<token>` and shows the set-new-password form.
export async function issuePasswordReset(
  db: D1Database,
  user: { id: string; email: string; display_name?: string | null },
  siteBase: string,
): Promise<string> {
  const token = newToken();
  const created = Date.now();
  await db
    .prepare('INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(token, user.id, created, created + RESET_TTL_MS)
    .run();

  const link = `${siteBase}/#reset=${encodeURIComponent(token)}`;
  const hi = user.display_name ? `Hi ${user.display_name},` : 'Hi,';
  const body =
    `${hi}\n\n` +
    `We got a request to reset the password on your Mortgage Tool Kit account. ` +
    `Open the link below to choose a new one:\n\n` +
    `${link}\n\n` +
    `The link expires in 1 hour and can be used once. If you didn't ask for this, ` +
    `you can safely ignore this email - your password won't change.\n`;

  await enqueueEmail(db, {
    to: user.email,
    subject: 'Reset your Mortgage Tool Kit password',
    body,
    kind: 'reset',
  });
  return token;
}

// Timing-safe string compare for the relay bearer token.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
