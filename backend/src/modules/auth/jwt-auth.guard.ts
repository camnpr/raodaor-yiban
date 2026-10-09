import { Injectable, type CanActivate, type ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../common/config/configuration';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { AuthedRequestUser, PlatformJwtPayload } from './jwt.types';

/** 用户态鉴权：Bearer 本平台 JWT（15 分钟 + refresh，PRD §6.3） */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthedRequestUser }>();
    const authorization = request.headers['authorization'] ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;

    if (!token) {
      throw new BusinessException(2001, '未登录', HttpStatus.UNAUTHORIZED);
    }

    let payload: PlatformJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<PlatformJwtPayload>(token, {
        secret: this.config.get('jwt.accessSecret', { infer: true }),
      });
    } catch {
      throw new BusinessException(2001, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED);
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new BusinessException(2001, '无效的访问令牌', HttpStatus.UNAUTHORIZED);
    }

    request.user = { userId: payload.sub, roles: payload.roles ?? [] };
    return true;
  }
}
