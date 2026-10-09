import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AuthUserVo, type LoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import type { Capabilities } from './jwt.types';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** IDStack SSO 回调：授权码换本平台 JWT 对 */
  @Post('idstack/login')
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.loginWithIdstackCode(dto);
  }

  /** 当前登录用户（能力布尔驱动前端入口 + 会员状态摘要） */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @Req() request: Request & { user: { userId: string; roles: string[] } },
  ): Promise<{ user: AuthUserVo; capabilities: Capabilities; membership: { tier: string | null; expiresAt: Date | null; isActive: boolean } }> {
    return this.auth.me(request.user);
  }

  /** 刷新令牌（旋转签发） */
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto): Promise<LoginResult> {
    return this.auth.refresh(dto.refreshToken);
  }
}
