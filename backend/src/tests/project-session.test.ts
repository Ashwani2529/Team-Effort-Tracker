import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, hashSessionToken, projectSessionCookieOptions, setProjectSession, updateProjectSession, verifyPassword, verifySessionToken } from '../middleware/auth.js';
import { StoredProjectSession } from '../models/index.js';

describe('project password sessions', () => {
  afterEach(() => vi.restoreAllMocks());
  it('hashes and verifies project passwords without retaining plaintext', async () => {
    const hash = await hashPassword('shared-project-password');
    expect(hash).not.toContain('shared-project-password');
    expect(await verifyPassword('shared-project-password', hash)).toBe(true);
    expect(await verifyPassword('incorrect-password', hash)).toBe(false);
  });

  it('stores only a deterministic hash of the opaque browser token', () => {
    const token = 'opaque-session-token';
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).not.toBe(hashSessionToken(token + '-changed'));
  });

  it('uses a secure cross-site cookie for production or an HTTPS frontend and a local-safe cookie otherwise', () => {
    expect(projectSessionCookieOptions('production')).toMatchObject({ httpOnly: true, sameSite: 'none', secure: true, path: '/' });
    expect(projectSessionCookieOptions('development', 'https://effort-tracker-board.vercel.app')).toMatchObject({ httpOnly: true, sameSite: 'none', secure: true, path: '/' });
    expect(projectSessionCookieOptions('development', 'http://localhost:5173')).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
    expect(projectSessionCookieOptions('test', 'http://localhost:5173')).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  });

  it('persists a hashed opaque token for 30 days and sends only the raw token to the browser', async () => {
    const create = vi.spyOn(StoredProjectSession, 'create').mockResolvedValue({});
    const cookie = vi.fn(), before = Date.now();
    await setProjectSession({ cookie } as any, { projectId: '507f1f77bcf86cd799439011', memberId: '507f191e810c19729de860ea', role: 'team', adminVerified: false, passwordVersion: 1 });
    const [stored] = create.mock.calls[0]! as any[];
    const [, browserToken, options] = cookie.mock.calls[0]!;
    expect(stored.tokenHash).toBe(hashSessionToken(browserToken));
    expect(stored.tokenHash).not.toContain(browserToken);
    expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(options.maxAge).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it('loads and updates the same persistent session record when switching modes', async () => {
    const expiresAt = Date.now() + 60_000;
    vi.spyOn(StoredProjectSession, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'session-1', projectId: 'project-1', memberId: 'member-1', role: 'team', adminVerified: false, passwordVersion: 2, expiresAt }) } as any);
    const session = await verifySessionToken('opaque-token');
    expect(session).toMatchObject({ sessionId: 'session-1', projectId: 'project-1', memberId: 'member-1', role: 'team', expiresAt });
    const update = vi.spyOn(StoredProjectSession, 'updateOne').mockResolvedValue({});
    await updateProjectSession(session!, { role: 'admin', adminVerified: true });
    expect(update).toHaveBeenCalledWith({ _id: 'session-1', revokedAt: null }, { $set: { role: 'admin', adminVerified: true } });
  });
});
