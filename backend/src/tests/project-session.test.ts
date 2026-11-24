import { describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, projectSessionCookieOptions, setProjectSession, verifyPassword, verifySessionToken } from '../middleware/auth.js';

describe('project password sessions', () => {
  it('hashes and verifies project passwords without retaining plaintext', async () => {
    const hash = await hashPassword('shared-project-password');
    expect(hash).not.toContain('shared-project-password');
    expect(await verifyPassword('shared-project-password', hash)).toBe(true);
    expect(await verifyPassword('incorrect-password', hash)).toBe(false);
  });

  it('signs mode, project and password version into the session', () => {
    const token = createSessionToken({ projectId: 'project-1', memberId: 'member-1', role: 'admin', adminVerified: true, passwordVersion: 3, expiresAt: Date.now() + 60_000 });
    expect(verifySessionToken(token)).toMatchObject({ projectId: 'project-1', memberId: 'member-1', role: 'admin', adminVerified: true, passwordVersion: 3 });
    expect(verifySessionToken(token + 'tampered')).toBeNull();
  });

  it('rejects expired sessions and admin mode without a remembered Admin grant', () => {
    expect(verifySessionToken(createSessionToken({ projectId: 'project-1', memberId: 'member-1', role: 'team', adminVerified: false, passwordVersion: 1, expiresAt: Date.now() - 1 }))).toBeNull();
    expect(verifySessionToken(createSessionToken({ projectId: 'project-1', memberId: 'member-1', role: 'admin', adminVerified: false, passwordVersion: 1, expiresAt: Date.now() + 60_000 }))).toBeNull();
  });

  it('preserves the original expiry when switching modes', () => {
    const expiresAt = Date.now() + 86_400_000;
    let token = '';
    const response = { cookie: (_name: string, value: string) => { token = value; } } as any;
    setProjectSession(response, { projectId: 'project-1', memberId: 'member-1', role: 'team', adminVerified: true, passwordVersion: 1, expiresAt });
    expect(verifySessionToken(token)?.expiresAt).toBe(expiresAt);
  });

  it('uses a secure cross-site cookie for production or an HTTPS frontend and a local-safe cookie otherwise', () => {
    expect(projectSessionCookieOptions('production')).toMatchObject({ httpOnly: true, sameSite: 'none', secure: true, path: '/' });
    expect(projectSessionCookieOptions('development', 'https://effort-tracker-board.vercel.app')).toMatchObject({ httpOnly: true, sameSite: 'none', secure: true, path: '/' });
    expect(projectSessionCookieOptions('development', 'http://localhost:5173')).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
    expect(projectSessionCookieOptions('test', 'http://localhost:5173')).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  });
});
