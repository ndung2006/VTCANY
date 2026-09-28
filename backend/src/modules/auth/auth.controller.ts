import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { RateLimitGuard } from './rate-limit.guard';

class LoginDto {
  @IsString()
  username!: string;
  @IsString()
  password!: string;
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
