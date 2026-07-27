import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, newToken, sessionId } from './auth';
import { uuid } from './util';

type Bindings = {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  SESSION_SECRET: string;
};

type SessionUser = { id: string; email: string; display_name: string | null; role: string };

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
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// ---------------- helpers ----------------
function publicUser(row: any): SessionUser {
  return { id: row.id, email: row.email, display_name: row.display_name ?? null, role: row.role ?? 'user' };
}

async function currentUser(c: any): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const id = await sessionId(token, c.env.SESSION_SECRET);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role, s.expires_at
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
app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return c.json({ error: 'email and password required' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ error: 'invalid email or password' }, 401);
  }
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
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(next), user.id).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  await startSession(c, user.id);
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
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)',
  ).bind(id, email, await hashPassword(password), display_name, role, Date.now()).run();
  return c.json({ user: { id, email, display_name, role, created_at: Date.now() } }, 201);
});

app.delete('/admin/users/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: 'you cannot delete your own account' }, 400);
  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: 'not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

export default app;
