import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const sign = (v) => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(v).digest('base64url');

export function setSession(user) {
  const p = Buffer.from(JSON.stringify(user)).toString('base64url');
  cookies().set('sid', `${p}.${sign(p)}`, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 8 });
}

export function getUser() {
  const c = cookies().get('sid')?.value;
  if (!c) return null;
  const [p, s] = c.split('.');
  if (!p || !s || sign(p) !== s) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}

export function requireRole(role) {
  const u = getUser();
  if (!u) redirect('/login');
  if (u.role !== role) redirect('/' + u.role);
  return u;
}
