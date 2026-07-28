// Password hashing (PBKDF2 via Web Crypto — no native deps) and session-token
// helpers. The stored session id is HMAC-SHA256(rawToken, SESSION_SECRET) so a
// leaked DB row cannot be replayed as a cookie.

// Cloudflare Workers cap PBKDF2 at 100k iterations per call, so we CHAIN rounds:
// ROUNDS x ITER = effective work factor (4 x 100k = 400k), each call within the cap.
const ITER = 100_000;
const ROUNDS = 4;
const enc = new TextEncoder();

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(keyBytes: BufferSource, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', keyBytes, 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
}
// Chain PBKDF2 rounds: feed each round's output as the next round's key material.
async function chain(password: string, salt: Uint8Array, iter: number, rounds: number): Promise<Uint8Array> {
  let bits = new Uint8Array(await pbkdf2(enc.encode(password), salt, iter));
  for (let i = 1; i < rounds; i++) bits = new Uint8Array(await pbkdf2(bits, salt, iter));
  return bits;
}

// New format: pbkdf2r$<rounds>$<iter>$<saltB64>$<hashB64>
// Legacy format (still verified): pbkdf2$<iter>$<saltB64>$<hashB64>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await chain(password, salt, ITER, ROUNDS);
  return `pbkdf2r$${ROUNDS}$${ITER}$${b64(salt.buffer)}$${b64(bits.buffer)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  let want: Uint8Array, bits: Uint8Array;
  if (parts[0] === 'pbkdf2r') {
    const rounds = Number(parts[1]), iter = Number(parts[2]), salt = fromB64(parts[3]);
    want = fromB64(parts[4]);
    bits = await chain(password, salt, iter, rounds);
  } else if (parts[0] === 'pbkdf2') {
    const iter = Number(parts[1]), salt = fromB64(parts[2]);
    want = fromB64(parts[3]);
    bits = new Uint8Array(await pbkdf2(enc.encode(password), salt, iter));
  } else return false;
  if (bits.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ want[i];
  return diff === 0;
}

export function newToken(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sessionId(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(token));
  return hex(sig);
}
