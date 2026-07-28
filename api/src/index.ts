import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, newToken, sessionId } from './auth';
import { uuid } from './util';
import { enqueueEmail, issueVerification, safeEqual } from './mail';

type Bindings = {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  SESSION_SECRET: string;
  MAIL_RELAY_TOKEN: string;   // shared secret Jarvis uses to drain the outbox
};

type SessionUser = { id: string; email: string; display_name: string | null; role: string; must_change: boolean; email_verified: boolean };

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>();

const COOKIE = 'mtk_session';
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// ---------------- CORS ----------------
app.use('*', cors({
  origin: (origin, c) => {
    if (origin === c.env.ALLOWED_ORIGIN) return origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '')) return origin;
    return c.env.ALLOWED_ORIGIN;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// ---------------- helpers ----------------
function publicUser(row: any): SessionUser {
  return { id: row.id, email: row.email, display_name: row.display_name ?? null, role: row.role ?? 'user', must_change: !!row.must_change_password, email_verified: !!row.email_verified };
}

// Bearer-token guard for the endpoints Jarvis's mail relay calls.
const relayAuth = async (c: any, next: any) => {
  const secret = c.env.MAIL_RELAY_TOKEN || '';
  const hdr = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !hdr || !safeEqual(hdr, secret)) return c.json({ error: 'unauthorized' }, 401);
  await next();
};

async function currentUser(c: any): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const id = await sessionId(token, c.env.SESSION_SECRET);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role, u.must_change_password, u.email_verified, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).bind(id).first();
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) return null;
  return publicUser(row);
}

const auth = async (c: any, next: any) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
};

const requireAdmin = async (c: any, next: any) => {
  if (c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403);
  await next();
};

// Set the session cookie for a user; returns the raw token's session row insert.
async function startSession(c: any, userId: string) {
  const token = newToken();
  const id = await sessionId(token, c.env.SESSION_SECRET);
  const created = Date.now();
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(id, userId, created, created + SESSION_MS).run();
  const host = new URL(c.req.url).hostname;
  const secure = host !== 'localhost' && host !== '127.0.0.1';
  setCookie(c, COOKIE, token, {
    httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

// ---------------- health ----------------
app.get('/', (c) => c.json({ ok: true, service: 'mtk-api' }));

// ---------------- auth ----------------
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return c.json({ error: 'email and password required' }, 400);

  // IP-based throttling
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const att = await c.env.DB.prepare('SELECT count, reset_at FROM login_attempts WHERE ip = ?').bind(ip).first();
  let count = 0, resetAt = now + ATTEMPT_WINDOW_MS;
  if (att && Number(att.reset_at) > now) { count = Number(att.count); resetAt = Number(att.reset_at); }
  if (count >= MAX_ATTEMPTS) return c.json({ error: 'too many attempts - please try again in a few minutes' }, 429);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    await c.env.DB.prepare(
      'INSERT INTO login_attempts (ip, count, reset_at) VALUES (?,?,?) ON CONFLICT(ip) DO UPDATE SET count = ?, reset_at = ?',
    ).bind(ip, count + 1, resetAt, count + 1, resetAt).run();
    return c.json({ error: 'invalid email or password' }, 401);
  }
  // success: clear this IP's attempts and prune expired sessions
  await c.env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  await startSession(c, user.id as string);
  return c.json({ user: publicUser(user) });
});

app.post('/auth/logout', auth, async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(await sessionId(token, c.env.SESSION_SECRET)).run();
  }
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

app.get('/auth/me', auth, (c) => c.json({ user: c.get('user') }));

// Self-service password change: verify current password, update the hash,
// invalidate ALL existing sessions, then issue a fresh session for this device
// (so the user stays logged in here but is signed out everywhere else).
app.post('/auth/change-password', auth, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const current = String(b.current_password ?? '');
  const next = String(b.new_password ?? '');
  if (next.length < 8) return c.json({ error: 'new password must be at least 8 characters' }, 400);

  const user = c.get('user');
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
  if (!row || !(await verifyPassword(current, row.password_hash as string))) {
    return c.json({ error: 'current password is incorrect' }, 401);
  }
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .bind(await hashPassword(next), user.id).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  await startSession(c, user.id);
  return c.json({ ok: true });
});

// ---------------- scenarios (saved input snapshots) ----------------
const MAX_SCENARIOS = 100;
const MAX_DATA_BYTES = 200_000;

function cleanName(v: any): string { return String(v ?? "").trim().slice(0, 120); }
function validData(v: any): string | null {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? {});
  if (s.length > MAX_DATA_BYTES) return null;
  return s;
}

app.get('/scenarios', auth, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at, updated_at FROM scenarios WHERE user_id = ? ORDER BY updated_at DESC',
  ).bind(c.get('user').id).all();
  return c.json({ scenarios: results });
});

app.post('/scenarios', auth, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const name = cleanName(b.name);
  const data = validData(b.data);
  if (!name) return c.json({ error: 'a name is required' }, 400);
  if (data === null) return c.json({ error: 'scenario data too large' }, 413);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM scenarios WHERE user_id = ?').bind(c.get('user').id).first();
  if (Number((count as any).n) >= MAX_SCENARIOS) return c.json({ error: 'scenario limit reached' }, 409);
  const id = uuid(), ts = Date.now();
  await c.env.DB.prepare('INSERT INTO scenarios (id, user_id, name, data, created_at, updated_at) VALUES (?,?,?,?,?,?)')
    .bind(id, c.get('user').id, name, data, ts, ts).run();
  return c.json({ scenario: { id, name, created_at: ts, updated_at: ts } }, 201);
});

app.get('/scenarios/:id', auth, async (c) => {
  const row = await c.env.DB.prepare('SELECT id, name, data, created_at, updated_at FROM scenarios WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id).first();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ scenario: row });
});

app.put('/scenarios/:id', auth, async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM scenarios WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).first();
  if (!existing) return c.json({ error: 'not found' }, 404);
  const b = await c.req.json().catch(() => ({} as any));
  const sets: string[] = [], binds: any[] = [];
  if (b.name !== undefined) { const n = cleanName(b.name); if (!n) return c.json({ error: 'name required' }, 400); sets.push('name = ?'); binds.push(n); }
  if (b.data !== undefined) { const d = validData(b.data); if (d === null) return c.json({ error: 'data too large' }, 413); sets.push('data = ?'); binds.push(d); }
  if (!sets.length) return c.json({ error: 'nothing to update' }, 400);
  sets.push('updated_at = ?'); binds.push(Date.now());
  binds.push(id);
  await c.env.DB.prepare(`UPDATE scenarios SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  return c.json({ ok: true });
});

app.delete('/scenarios/:id', auth, async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM scenarios WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---------------- working state + preferences (autosave) ----------------
app.get('/state', auth, async (c) => {
  const row = await c.env.DB.prepare('SELECT work_state, prefs FROM users WHERE id = ?').bind(c.get('user').id).first();
  const parse = (v: any) => { if (!v) return null; try { return JSON.parse(v as string); } catch { return null; } };
  return c.json({ work_state: parse((row as any)?.work_state), prefs: parse((row as any)?.prefs) });
});

app.put('/state', auth, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  if (b.work_state !== undefined) {
    const d = validData(b.work_state);
    if (d === null) return c.json({ error: 'state too large' }, 413);
    await c.env.DB.prepare('UPDATE users SET work_state = ? WHERE id = ?').bind(d, c.get('user').id).run();
  }
  if (b.prefs !== undefined) {
    const p = JSON.stringify(b.prefs).slice(0, 2000);
    await c.env.DB.prepare('UPDATE users SET prefs = ? WHERE id = ?').bind(p, c.get('user').id).run();
  }
  return c.json({ ok: true });
});

// ---------------- admin: users ----------------
app.get('/admin/users', auth, requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at',
  ).all();
  return c.json({ users: results });
});

app.post('/admin/users', auth, requireAdmin, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const email = String(b.email ?? '').trim().toLowerCase();
  const password = String(b.password ?? '');
  const role = b.role === 'admin' ? 'admin' : 'user';
  const display_name = b.display_name ? String(b.display_name).trim() : null;
  if (!email || !email.includes('@')) return c.json({ error: 'a valid email is required' }, 400);
  if (password.length < 8) return c.json({ error: 'password must be at least 8 characters' }, 400);
  const dupe = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (dupe) return c.json({ error: 'a user with that email already exists' }, 409);
  const id = uuid();
  // New users get a temp password and must change it on first login.
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, role, must_change_password, created_at) VALUES (?,?,?,?,?,1,?)',
  ).bind(id, email, await hashPassword(password), display_name, role, Date.now()).run();
  // Queue a verification email (Jarvis's relay actually sends it).
  const apiBase = new URL(c.req.url).origin;
  await issueVerification(c.env.DB, { id, email, display_name }, apiBase, c.env.ALLOWED_ORIGIN).catch(() => {});
  return c.json({ user: { id, email, display_name, role, created_at: Date.now() } }, 201);
});

// Admin resets a user's password (they'll be forced to change it on next login).
app.post('/admin/users/:id/password', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({} as any));
  const password = String(b.password ?? '');
  if (password.length < 8) return c.json({ error: 'password must be at least 8 characters' }, 400);
  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
    .bind(await hashPassword(password), id).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();  // sign them out everywhere
  return c.json({ ok: true });
});

app.delete('/admin/users/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: 'you cannot delete your own account' }, 400);
  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: 'not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM scenarios WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

// ---------------- email verification ----------------
// User clicks the emailed link. Marks them verified, then bounces to the site.
app.get('/auth/verify', async (c) => {
  const token = c.req.query('token') || '';
  const site = c.env.ALLOWED_ORIGIN;
  const row = token
    ? await c.env.DB.prepare('SELECT token, user_id, expires_at, used_at FROM email_verifications WHERE token = ?').bind(token).first()
    : null;
  if (!row || row.used_at || Number(row.expires_at) < Date.now()) {
    return c.redirect(`${site}/#verify=invalid`, 302);
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id),
    c.env.DB.prepare('UPDATE email_verifications SET used_at = ? WHERE token = ?').bind(Date.now(), token),
  ]);
  return c.redirect(`${site}/#verify=ok`, 302);
});

// Signed-in user asks for a fresh verification link.
app.post('/auth/resend-verification', auth, async (c) => {
  const u = c.get('user');
  if (u.email_verified) return c.json({ ok: true, already: true });
  const apiBase = new URL(c.req.url).origin;
  await issueVerification(c.env.DB, { id: u.id, email: u.email, display_name: u.display_name }, apiBase, c.env.ALLOWED_ORIGIN);
  return c.json({ ok: true });
});

// ---------------- outbox relay (Jarvis) ----------------
// Jarvis's timer pulls unsent messages, sends them, then reports the result.
app.get('/relay/outbox', relayAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, to_email, subject, body, kind, attempts FROM email_outbox
     WHERE sent_at IS NULL AND attempts < 5 ORDER BY created_at LIMIT 25`,
  ).all();
  return c.json({ messages: results });
});

app.post('/relay/outbox/:id/result', relayAuth, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({} as any));
  if (b.success) {
    await c.env.DB.prepare('UPDATE email_outbox SET sent_at = ?, last_error = NULL WHERE id = ?')
      .bind(Date.now(), id).run();
  } else {
    await c.env.DB.prepare('UPDATE email_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?')
      .bind(String(b.error ?? 'send failed').slice(0, 500), id).run();
  }
  return c.json({ ok: true });
});

export default app;
