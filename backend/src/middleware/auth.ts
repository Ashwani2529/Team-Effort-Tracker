import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { CookieOptions, Request, Response } from 'express';
import type { Role } from '@effort-tracker/shared';
import { env } from '../config/env.js';
import { StoredProjectSession } from '../models/index.js';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'effort_project_session';

export interface ProjectSession {
  sessionId: string;
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

export function hashSessionToken(token: string): string { return createHash('sha256').update(token).digest('base64url'); }

export async function verifySessionToken(token: string | undefined): Promise<ProjectSession | null> {
  if (!token) return null;
  const stored = await StoredProjectSession.findOne({ tokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { $gt: new Date() } }).lean();
  if (!stored || !stored.projectId || !stored.memberId || typeof stored.adminVerified !== 'boolean' || !['team', 'admin'].includes(stored.role)) return null;
  if (stored.role === 'admin' && !stored.adminVerified) return null;
  return {
    sessionId: String(stored._id), projectId: String(stored.projectId), memberId: String(stored.memberId), role: stored.role,
    adminVerified: stored.adminVerified, passwordVersion: stored.passwordVersion, expiresAt: new Date(stored.expiresAt).getTime()
  };
}

export function cookieValue(header: string | undefined, name = SESSION_COOKIE): string | undefined {
  return header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function sessionFromRequest(req: Request): Promise<ProjectSession | null> { return verifySessionToken(cookieValue(req.headers.cookie)); }

export function projectSessionCookieOptions(nodeEnv = env.NODE_ENV, frontendOrigin = env.FRONTEND_ORIGIN): CookieOptions {
  const crossSiteHttps = nodeEnv === 'production' || frontendOrigin.split(',').some((origin) => origin.trim().startsWith('https://'));
  return { httpOnly: true, sameSite: crossSiteHttps ? 'none' : 'lax', secure: crossSiteHttps, path: '/' };
}

export async function setProjectSession(res: Response, session: Omit<ProjectSession, 'sessionId' | 'expiresAt'> & { expiresAt?: number }): Promise<void> {
  const configuredMaxAge = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = session.expiresAt ?? Date.now() + configuredMaxAge;
  const maxAge = Math.max(0, expiresAt - Date.now());
  const token = randomBytes(32).toString('base64url');
  await StoredProjectSession.create({ ...session, tokenHash: hashSessionToken(token), expiresAt: new Date(expiresAt) });
  res.cookie(SESSION_COOKIE, token, { ...projectSessionCookieOptions(), maxAge });
}

export async function updateProjectSession(session: ProjectSession, changes: Partial<Pick<ProjectSession, 'role' | 'adminVerified' | 'passwordVersion'>>): Promise<void> {
  await StoredProjectSession.updateOne({ _id: session.sessionId, revokedAt: null }, { $set: changes });
}

export async function clearProjectSession(req: Request, res: Response): Promise<void> {
  const token = cookieValue(req.headers.cookie);
  if (token) await StoredProjectSession.updateOne({ tokenHash: hashSessionToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.clearCookie(SESSION_COOKIE, projectSessionCookieOptions());
}
