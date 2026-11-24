import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { CookieOptions, Request, Response } from 'express';
import type { Role } from '@effort-tracker/shared';
import { env } from '../config/env.js';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'effort_project_session';

export interface ProjectSession {
  projectId: string;
  memberId: string;
  role: Role;
  adminVerified: boolean;
  passwordVersion: number;
  expiresAt: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const [algorithm, saltValue, digestValue] = String(encoded || '').split(':');
  if (algorithm !== 'scrypt' || !saltValue || !digestValue) return false;
  const expected = Buffer.from(digestValue, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifySetupPassword(password: string): boolean {
  const expected = createHash('sha256').update(env.APP_SETUP_PASSWORD).digest();
  const actual = createHash('sha256').update(password).digest();
  return timingSafeEqual(actual, expected);
}

function sign(payload: string): string { return createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url'); }

export function createSessionToken(session: ProjectSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): ProjectSession | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload), 'base64url'), actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ProjectSession;
    if (!session.projectId || !session.memberId || typeof session.adminVerified !== 'boolean' || !['team', 'admin'].includes(session.role) || session.expiresAt <= Date.now()) return null;
    if (session.role === 'admin' && !session.adminVerified) return null;
    return session;
  } catch { return null; }
}

export function cookieValue(header: string | undefined, name = SESSION_COOKIE): string | undefined {
  return header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function sessionFromRequest(req: Request): ProjectSession | null { return verifySessionToken(cookieValue(req.headers.cookie)); }

export function projectSessionCookieOptions(nodeEnv = env.NODE_ENV, frontendOrigin = env.FRONTEND_ORIGIN): CookieOptions {
  const crossSiteHttps = nodeEnv === 'production' || frontendOrigin.split(',').some((origin) => origin.trim().startsWith('https://'));
  return { httpOnly: true, sameSite: crossSiteHttps ? 'none' : 'lax', secure: crossSiteHttps, path: '/' };
}

export function setProjectSession(res: Response, session: Omit<ProjectSession, 'expiresAt'> & { expiresAt?: number }): void {
  const configuredMaxAge = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = session.expiresAt ?? Date.now() + configuredMaxAge;
  const maxAge = Math.max(0, expiresAt - Date.now());
  res.cookie(SESSION_COOKIE, createSessionToken({ ...session, expiresAt }), { ...projectSessionCookieOptions(), maxAge });
}

export function clearProjectSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, projectSessionCookieOptions());
}
