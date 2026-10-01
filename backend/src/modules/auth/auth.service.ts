import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { END_USERS, EndUser, OAuthProvider, PROFILES, SESSIONS, USERS, CmsUser, Role, isOAuthProvider, permissionsFor } from './users.store';
import { PrismaService } from '../../prisma/prisma.service';

const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000;
const ACCESS_TTL_S = 3600;

// Admin CMS: uu tien Postgres (bang admin_users, seed tu USERS khi bang trong) de
// doi mat khau ben vung qua restart; khong co DB (dev/test) thi dung store in-memory.
// End-user OAuth van in-memory (users/user_profiles/user_sessions trong migration 0001).
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private refreshTokens = new Map<string, { userId: string; kind: 'cms' | 'enduser'; exp: number }>();
  private dbSeeded = false;
  private dbDown = false;

  constructor(
    private jwt: JwtService,
    @Optional() private prisma?: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDbSeed();
  }

  // Seed admin mac dinh vao Postgres khi bang admin_users con trong. Id giu nguyen
  // cua store in-memory de token/lien ket cu khong bi lech.
  private async ensureDbSeed(): Promise<void> {
    if (!this.prisma || this.dbSeeded || this.dbDown) return;
    try {
      const count = await this.prisma.adminUser.count();
      if (count === 0) {
        for (const u of USERS) {
          await this.prisma.adminUser.create({
            data: {
              id: u.id,
              username: u.username,
              email: u.email ?? null,
              passwordHash: u.passwordHash,
              fullName: u.fullName ?? null,
              roleName: u.role,
              status: 'active',
            },
          });
        }
        this.logger.log(`Da seed ${USERS.length} tai khoan admin vao Postgres.`);
      }
      this.dbSeeded = true;
    } catch (e) {
      this.dbDown = true;
      this.logger.warn(`Bo qua admin DB (dung store in-memory): ${(e as Error).message}`);
    }
  }

  private rowToUser(row: any): CmsUser {
    return {
      id: row.id,
      username: row.username || row.email || row.id,
      email: row.email ?? undefined,
      passwordHash: row.passwordHash,
      fullName: row.fullName ?? undefined,
      role: (row.roleName as Role) || 'admin',
    };
  }

  // Tim tai khoan CMS: DB truoc (neu co), fallback in-memory. status != active -> null.
  private async findCmsUser(where: { id?: string; email?: string; username?: string }): Promise<{ user: CmsUser; source: 'db' | 'memory' } | null> {
    if (this.prisma && !this.dbDown) {
      try {
        await this.ensureDbSeed();
        const row = await this.prisma.adminUser.findFirst({
          where: where.id
            ? { id: where.id }
            : where.email
              ? { email: { equals: where.email, mode: 'insensitive' } }
              : { username: where.username },
        });
        if (row) {
          if (row.status !== 'active') return null;
          return { user: this.rowToUser(row), source: 'db' };
        }
      } catch (e) {
        this.dbDown = true;
        this.logger.warn(`Admin DB loi, fallback in-memory: ${(e as Error).message}`);
      }
    }
    const mem = USERS.find((u) =>
      where.id ? u.id === where.id
        : where.email ? (u.email || '').toLowerCase() === (where.email || '').toLowerCase()
          : u.username === where.username,
    );
    return mem ? { user: mem, source: 'memory' } : null;
  }

  // ---- CMS username login (giữ tương thích app/CMS hiện tại) ----
  async login(username: string, password: string) {
    const found = await this.findCmsUser({ username });
    if (!found) throw new Error('invalid credentials');
    const ok = await bcrypt.compare(password, found.user.passwordHash);
    if (!ok) throw new Error('invalid credentials');
    await this.touchLastLogin(found);
    return this.issueCmsPair(found.user.id, found.user.username, found.user.role);
  }

  // ---- Bước 2: POST /auth/admin/login {email, password} ----
  async adminLogin(email: string, password: string) {
    const found = await this.findCmsUser({ email });
    if (!found) throw new Error('invalid credentials');
    const ok = await bcrypt.compare(password, found.user.passwordHash);
    if (!ok) throw new Error('invalid credentials');
    await this.touchLastLogin(found);
    return this.issueCmsPair(found.user.id, found.user.username, found.user.role);
  }

  private async touchLastLogin(found: { user: CmsUser; source: 'db' | 'memory' }): Promise<void> {
    if (found.source !== 'db' || !this.prisma) return;
    await this.prisma.adminUser
      .update({ where: { id: found.user.id }, data: { lastLogin: new Date() } })
      .catch(() => undefined);
  }

  // ---- Đổi mật khẩu admin: ghi DB (bền qua restart), thu hồi refresh token cũ ----
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword && newPassword === currentPassword) throw new Error('password unchanged');
    if (!newPassword || newPassword.length < 10) throw new Error('weak password');
    const found = await this.findCmsUser({ id: userId });
    if (!found) throw new Error('account not found');
    const ok = await bcrypt.compare(currentPassword || '', found.user.passwordHash);
    if (!ok) throw new Error('current password incorrect');
    const hash = await bcrypt.hash(newPassword, 10);
    if (found.source === 'db' && this.prisma) {
      await this.prisma.adminUser.update({ where: { id: found.user.id }, data: { passwordHash: hash } });
    }
    const mem = USERS.find((u) => u.id === found.user.id);
    if (mem) mem.passwordHash = hash;
    for (const [tok, rec] of this.refreshTokens) {
      if (rec.userId === found.user.id && rec.kind === 'cms') this.refreshTokens.delete(tok);
    }
    this.logger.log(`Admin ${found.user.username} da doi mat khau.`);
    return { ok: true };
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
  async me(payload: any) {
    if (!payload) throw new Error('invalid token');
    if (payload.kind === 'cms' || payload.role) {
      const found = await this.findCmsUser({ id: payload.sub });
      if (!found) throw new Error('account not found');
      const user = found.user;
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
      const found = await this.findCmsUser({ id: rec.userId });
      if (!found) throw new Error('invalid refresh token');
      return this.issueCmsPair(found.user.id, found.user.username, found.user.role);
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
