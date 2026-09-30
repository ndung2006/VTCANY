import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { END_USERS, EndUser, OAuthProvider, PROFILES, SESSIONS, USERS, isOAuthProvider, permissionsFor } from './users.store';

const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000;
const ACCESS_TTL_S = 3600;

// Store in-memory. Len Postgres/Redis: users/user_profiles/user_sessions +
// refresh token hash + expiry + reuse detection.
@Injectable()
export class AuthService {
  private refreshTokens = new Map<string, { userId: string; kind: 'cms' | 'enduser'; exp: number }>();

  constructor(private jwt: JwtService) {}

  // ---- CMS username login (giữ tương thích app/CMS hiện tại) ----
  async login(username: string, password: string) {
    const user = USERS.find((u) => u.username === username);
    if (!user) throw new Error('invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('invalid credentials');
    return this.issueCmsPair(user.id, user.username, user.role);
  }

  // ---- Bước 2: POST /auth/admin/login {email, password} ----
  async adminLogin(email: string, password: string) {
    const user = USERS.find((u) => (u.email || '').toLowerCase() === (email || '').toLowerCase());
    if (!user) throw new Error('invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('invalid credentials');
    return this.issueCmsPair(user.id, user.username, user.role);
  }

  // ---- Bước 2: POST /auth/oauth/:provider {idToken} ----
  async oauthLogin(provider: string, idToken: string) {
    if (!isOAuthProvider(provider)) throw new Error('unsupported provider (only google, facebook)');
    if (!idToken) throw new Error('missing idToken');
    const profile = await this.verifyIdToken(provider, idToken);
    let user = END_USERS.find((u) => u.provider === provider && u.providerId === profile.providerId);
    if (!user) {
      if (profile.email) {
        user = END_USERS.find((u) => (u.email || '').toLowerCase() === profile.email!.toLowerCase());
      }
    }
    if (!user) {
      user = {
        id: `u-${randomUUID()}`,
        email: profile.email,
        avatar: profile.avatar,
        displayName: profile.displayName,
        provider,
        providerId: profile.providerId,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      END_USERS.push(user);
      PROFILES.push({ id: `p-${randomUUID()}`, userId: user.id, name: profile.displayName || 'Tôi', avatarUrl: profile.avatar, isKidsProfile: false });
    }
    if (user.status !== 'active') throw new Error('account banned');
    return this.issueEnduserPair(user);
  }

  // ---- Bước 2: GET /auth/me ----
  me(payload: any) {
    if (!payload) throw new Error('invalid token');
    if (payload.kind === 'cms' || payload.role) {
      const user = USERS.find((u) => u.id === payload.sub);
      if (!user) throw new Error('account not found');
      return {
        kind: 'cms' as const,
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role },
        permissions: permissionsFor(user.role),
      };
    }
    const user = END_USERS.find((u) => u.id === payload.sub);
    if (!user || user.status !== 'active') throw new Error('account not found');
    return { kind: 'enduser' as const, user, profiles: PROFILES.filter((p) => p.userId === user!.id) };
  }

  async refresh(refreshToken: string) {
    const rec = this.refreshTokens.get(refreshToken);
    // Rotation: token cu vo hieu ngay sau khi doi (chong replay).
    this.refreshTokens.delete(refreshToken);
    if (!rec || rec.exp < Date.now()) throw new Error('invalid refresh token');
    if (rec.kind === 'cms') {
      const user = USERS.find((u) => u.id === rec.userId);
      if (!user) throw new Error('invalid refresh token');
      return this.issueCmsPair(user.id, user.username, user.role);
    }
    const user = END_USERS.find((u) => u.id === rec.userId);
    if (!user || user.status !== 'active') throw new Error('invalid refresh token');
    return this.issueEnduserPair(user);
  }

  private async verifyIdToken(
    provider: OAuthProvider,
    idToken: string,
  ): Promise<{ providerId: string; email?: string; displayName?: string; avatar?: string }> {
    if (provider === 'google') {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!res.ok) throw new Error('invalid google idToken');
      const data = (await res.json()) as any;
      if (!data.sub) throw new Error('invalid google idToken');
      return { providerId: `google:${data.sub}`, email: data.email, displayName: data.name, avatar: data.picture };
    }
    const res = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw new Error('invalid facebook token');
    const data = (await res.json()) as any;
    if (!data.id) throw new Error('invalid facebook token');
    return {
      providerId: `facebook:${data.id}`,
      email: data.email,
      displayName: data.name,
      avatar: data.picture?.data?.url,
    };
  }

  private trackSession(userId: string, kind: 'cms' | 'enduser', refreshToken: string) {
    const sessionId = `sess-${randomUUID()}`;
    SESSIONS.set(sessionId, {
      sessionId, userId, kind, lastHeartbeat: Date.now(), isActive: true,
      refreshToken, refreshExp: Date.now() + REFRESH_TTL_MS,
    });
  }

  private async issueCmsPair(sub: string, username: string, role: string) {
    const permissions = permissionsFor(role as any);
    const access_token = await this.jwt.signAsync({ sub, username, role, permissions, kind: 'cms' });
    const refresh_token = randomBytes(32).toString('hex');
    this.refreshTokens.set(refresh_token, { userId: sub, kind: 'cms', exp: Date.now() + REFRESH_TTL_MS });
    this.trackSession(sub, 'cms', refresh_token);
    return { access_token, refresh_token, token_type: 'Bearer', expires_in: ACCESS_TTL_S, role, permissions };
  }

  private async issueEnduserPair(user: EndUser) {
    const access_token = await this.jwt.signAsync({ sub: user.id, kind: 'enduser', provider: user.provider });
    const refresh_token = randomBytes(32).toString('hex');
    this.refreshTokens.set(refresh_token, { userId: user.id, kind: 'enduser', exp: Date.now() + REFRESH_TTL_MS });
    this.trackSession(user.id, 'enduser', refresh_token);
    return { access_token, refresh_token, token_type: 'Bearer', expires_in: ACCESS_TTL_S, user };
  }
}
