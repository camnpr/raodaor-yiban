import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException } from '../exceptions/business.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthedRequestUser } from '../../modules/auth/jwt.types';

/**
 * 角色守卫：检查当前用户（JwtAuthGuard 挂载的 req.user.roles）是否命中 @Roles(...) 要求的任一角色。
 * 必须在 JwtAuthGuard 之后运行（@UseGuards(JwtAuthGuard, RolesGuard)）。
 * 角色来源是 IDStack JWT，IDStack 已配置 owner / system_admin 等业务角色。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthedRequestUser }>();
    const userRoles = request.user?.roles ?? [];
    const ok = required.some((role) => userRoles.includes(role));
    if (!ok) {
      throw new BusinessException(
        403,
        `需要角色权限：${required.join(' / ')}`,
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
