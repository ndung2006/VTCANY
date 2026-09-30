import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RateLimitGuard } from './rate-limit.guard';

class LoginDto {
  @IsString()
  username!: string;
  @IsString()
  password!: string;
}

class AdminLoginDto {
  @IsString()
  email!: string;
  @IsString()
  password!: string;
}

class OAuthDto {
  @IsString()
  idToken!: string;
}

class RefreshDto {
  @IsString()
  refresh_token!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      return await this.auth.login(dto.username, dto.password);
    } catch {
      throw new HttpException('invalid credentials', HttpStatus.UNAUTHORIZED);
    }
  }

  // Bước 2: POST /api/v1/auth/admin/login {email, password} — cho CMS.
  @UseGuards(RateLimitGuard)
  @Post('admin/login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    try {
      return await this.auth.adminLogin(dto.email, dto.password);
    } catch {
      throw new HttpException('invalid credentials', HttpStatus.UNAUTHORIZED);
    }
  }

  // Bước 2: POST /api/v1/auth/oauth/:provider {idToken} — web chỉ dùng OAuth.
  @UseGuards(RateLimitGuard)
  @Post('oauth/:provider')
  async oauth(@Param('provider') provider: string, @Body() dto: OAuthDto) {
    try {
      return await this.auth.oauthLogin(provider, dto.idToken);
    } catch (e: any) {
      const msg = e?.message || 'oauth failed';
      const status = msg.includes('unsupported provider') ? HttpStatus.BAD_REQUEST : HttpStatus.UNAUTHORIZED;
      throw new HttpException(msg, status);
    }
  }

  // Bước 2: GET /api/v1/auth/me — thông tin user hiện tại.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    try {
      return this.auth.me(req.user);
    } catch {
      throw new HttpException('account not found', HttpStatus.UNAUTHORIZED);
    }
  }

  @UseGuards(RateLimitGuard)
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    try {
      return await this.auth.refresh(dto.refresh_token);
    } catch {
      throw new HttpException('invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
  }
}
