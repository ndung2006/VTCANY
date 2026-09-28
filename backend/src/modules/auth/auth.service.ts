import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { USERS } from './users.store';

const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000;

// Store in-memory. Len Postgres/Redis: refresh token hash + expiry + reuse detection.
@Injectable()
export class AuthService {
  private refreshTokens = new Map<string, { userId: string; exp: number }>();

  constructor(private jwt: JwtService) {}

  async login(username: string, password: string) {
    const user = USERS.find((u) => u.username === username);
    if (!user) throw new Error('invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('invalid credentials');
    return this.issuePair(user.id, user.username, user.role);
  }

  async refresh(refreshToken: string) {
    const rec = this.refreshTokens.get(refreshToken);
    // Rotation: token cu vo hieu ngay sau khi doi (chong replay).
    this.refreshTokens.delete(refreshToken);
    if (!rec || rec.exp < Date.now()) throw new Error('invalid refresh token');
    const user = USERS.find((u) => u.id === rec.userId);
    if (!user) throw new Error('invalid refresh token');
    return this.issuePair(user.id, user.username, user.role);
  }

  private async issuePair(sub: string, username: string, role: string) {
    const access_token = await this.jwt.signAsync({ sub, username, role });
    const refresh_token = randomBytes(32).toString('hex');
    this.refreshTokens.set(refresh_token, { userId: sub, exp: Date.now() + REFRESH_TTL_MS });
    return { access_token, refresh_token, token_type: 'Bearer', expires_in: 3600, role };
  }
}
