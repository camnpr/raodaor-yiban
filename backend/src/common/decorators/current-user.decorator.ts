import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequestUser } from '../../modules/auth/jwt.types';

/** 注入当前登录用户上下文（由 JwtAuthGuard 挂载到 request.user） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedRequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthedRequestUser }>();
    return request.user;
  },
);
