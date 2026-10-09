import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../common/config/configuration';
import type { AuthedRequestUser, PlatformJwtPayload } from './jwt.types';

/**
 * 可选鉴权（天气浏览公开，绑定/会员需登录）：
 * - 携带合法 Bearer token → 解析并挂载 `request.user`；
 * - 无 token / token 非法 / 过期 → 放行为匿名（`request.user = null`），由业务层按「匿名」降级。
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthedRequestUser | null }>();
    const authorization = request.headers['authorization'] ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;

    if (!token) {
      request.user = null;
      return true;
    }

    try {
      const payload = await this.jwt.verifyAsync<PlatformJwtPayload>(token, {
        secret: this.config.get('jwt.accessSecret', { infer: true }),
      });
      if (payload.type === 'access' && payload.sub) {
        request.user = { userId: payload.sub, roles: payload.roles ?? [] };
      } else {
        request.user = null;
      }
    } catch {
      // token 非法/过期：不作为拒绝理由，按匿名放行
      request.user = null;
    }
    return true;
  }
}
