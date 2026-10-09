import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { AppConfig } from '../../common/config/configuration';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type {
  AuthedRequestUser,
  Capabilities,
  IdstackJwtClaims,
  PlatformJwtPayload,
} from './jwt.types';
import { decodeTokenHeader, resolveJwksUri, selectPublicKey } from './idstack-jwks';

/** 平台运营角色（生态 allowedRoles 可扩展） */
const ADMIN_ROLES = new Set(['system_admin', 'owner']);

export interface AuthUserVo {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserVo;
  capabilities: Capabilities;
  /**
   * IDStack access_token 透传：前端凭它调 message `POST /auth/idstack/exchange`
   * 免二次登录换消息域凭证（天气预警/简报的站内消息中心展示）。
   * 仅 SSO 登录时存在（refresh 无法重建 IDStack token，字段缺省 = 前端沿用旧值）。
   */
  idstackAccessToken?: string;
}

/**
 * 从 IDStack JWT 的 `roles` claim 提取角色名（JWT 是唯一权威）。
 * 仅采纳「租户级（app_id 为空）」与本应用级角色，过滤用户在其他 APP 的角色。
 */
export function extractIdstackRoleNames(claims: IdstackJwtClaims, ownAppId: string): string[] {
  if (!Array.isArray(claims.roles)) return [];
  const names = new Set<string>();
  for (const item of claims.roles) {
    if (typeof item === 'string') {
      if (item.trim()) names.add(item.trim());
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const appId = typeof item.app_id === 'string' ? item.app_id : '';
    if (appId && appId !== ownAppId) continue;
    const name = item.role_name ?? item.role ?? item.name;
    if (typeof name === 'string' && name.trim()) names.add(name.trim());
  }
  return [...names];
}

/** 能力布尔：仅平台运营后台由 IDStack 角色驱动（长辈/守护人视图由亲情关系数据驱动） */
export function capabilitiesFromRoles(roles: string[]): Capabilities {
  return {
    consoleAdmin: roles.some((role) => ADMIN_ROLES.has(role)),
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** IDStack SSO 授权码换 token → 验签读角色 → 用户落库 → 签发本平台 JWT 对 */
  async loginWithIdstackCode(dto: LoginDto): Promise<LoginResult> {
    const idstack = this.config.get('idstack', { infer: true });
    if (!idstack.appId || !idstack.appApiKey || !idstack.appSecretKey) {
      throw new BusinessException(
        9001,
        'IDStack 未配置：请在后端 .env 中填写 IDSTACK_APP_ID / IDSTACK_APP_API_KEY / IDSTACK_APP_SECRET_KEY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const idstackJwksUri = resolveJwksUri(idstack.jwksUri, idstack.apiBaseUrl);

    // 1) 后端→后端换取 token（密钥不进浏览器；响应字段在 data 下）
    let accessToken: string;
    try {
      const res = await fetch(`${idstack.apiBaseUrl.replace(/\/+$/, '')}/api/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: dto.code,
          redirect_uri: dto.redirectUri,
          client_id: idstack.appApiKey,
          client_secret: idstack.appSecretKey,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { code?: number; data?: { access_token?: string }; message?: string }
        | null;
      const token = json?.data?.access_token;
      if (!res.ok || !token) {
        throw new Error(json?.message ?? `HTTP ${res.status}`);
      }
      accessToken = token;
    } catch (error) {
      throw new BusinessException(
        9002,
        `IDStack 授权码换取失败：${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 2) 验签 IDStack JWT，读取用户主键与 roles claim（钉死 RS256，见 idstack-jwks）
    let claims: IdstackJwtClaims;
    try {
      claims = await this.verifyIdStackAccessToken(accessToken, idstackJwksUri, idstack.issuer);
    } catch {
      throw new BusinessException(
        9003,
        'IDStack JWT 验签失败（检查 IDSTACK_JWKS_URI / IDSTACK_ISSUER）',
        HttpStatus.UNAUTHORIZED,
      );
    }
    // ⚠️ IDStack 的用户主键 claim 名是 `id`（非 OIDC 的 `sub`）；sub 仅作兼容兜底
    const idstackUserId = claims.id ?? claims.sub;
    if (!idstackUserId) {
      throw new BusinessException(
        9004,
        'IDStack JWT 缺少用户主键（id / sub）——请确认 IDStack 版本与 JWKS 配置（IDSTACK_JWKS_URI）是否匹配',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const roles = extractIdstackRoleNames(claims, idstack.appId);
    const displayName =
      claims.user_name ??
      claims.name ??
      claims.nickname ??
      claims.preferred_username ??
      `用户${idstackUserId.slice(-4)}`;

    // 3) 用户落库（upsert；注销账号拒绝登录）
    let user;
    try {
      const existing = await this.prisma.user.findUnique({ where: { idstackUserId } });
      if (existing?.deletedAt) {
        throw new BusinessException(2005, '该账号已注销', HttpStatus.FORBIDDEN);
      }
      user = await this.prisma.user.upsert({
        where: { idstackUserId },
        create: { idstackUserId, displayName },
        update: { displayName },
      });
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      throw new BusinessException(
        9005,
        `用户落库失败（数据库不可用或未执行迁移）：${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const capabilities = capabilitiesFromRoles(roles);
    return {
      accessToken: await this.signToken(user.id, roles, 'access'),
      refreshToken: await this.signToken(user.id, roles, 'refresh'),
      user: { id: user.id, displayName: user.displayName, avatarUrl: null },
      capabilities,
      idstackAccessToken: accessToken,
    };
  }

  /**
   * 验签 IDStack access_token（仅 RS256，无 HS256 兼容兜底）。
   * 钉死 `algorithms:['RS256']`：HS256 / none / 其它算法一律拒绝。
   */
  private async verifyIdStackAccessToken(
    token: string,
    jwksUri: string,
    issuer: string,
  ): Promise<IdstackJwtClaims> {
    const header = decodeTokenHeader(token);
    if (!header) throw new Error('IDStack token 格式非法');
    if (header.alg !== 'RS256') {
      throw new Error(`不支持的 IDStack token 算法: ${header.alg}（仅接受 RS256）`);
    }
    const publicKey = await selectPublicKey(jwksUri, header.kid);
    // ⚠️ 用 `secret` 传公钥（不能用 `publicKey`）：模块级 JwtModule 注册了 jwt.accessSecret，
    // 传 publicKey 会被覆盖，RS256 验签必然失败。
    return this.jwt.verifyAsync<IdstackJwtClaims>(token, {
      secret: publicKey,
      algorithms: ['RS256'],
      issuer,
    });
  }

  /** 当前登录用户信息（能力布尔随 token roles 派生 + 会员状态摘要） */
  async me(
    requestUser: AuthedRequestUser,
  ): Promise<{ user: AuthUserVo; capabilities: Capabilities; membership: { tier: string | null; expiresAt: Date | null; isActive: boolean } }> {
    const user = await this.prisma.user.findUnique({ where: { id: requestUser.userId } });
    if (!user || user.deletedAt) {
      throw new BusinessException(2001, '用户不存在或已注销', HttpStatus.UNAUTHORIZED);
    }
    const expiresAt = user.membershipExpiresAt ?? null;
    const isActive = !!expiresAt && expiresAt.getTime() > Date.now();
    return {
      user: { id: user.id, displayName: user.displayName, avatarUrl: null },
      capabilities: capabilitiesFromRoles(requestUser.roles),
      membership: {
        tier: isActive ? user.membershipTier : null,
        expiresAt: isActive ? expiresAt : null,
        isActive,
      },
    };
  }

  /** 刷新令牌（旋转签发） */
  async refresh(refreshToken: string): Promise<LoginResult> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    let payload: PlatformJwtPayload;
    try {
      payload = this.jwt.verify<PlatformJwtPayload>(refreshToken, { secret: jwtConfig.accessSecret });
    } catch {
      throw new BusinessException(2002, '刷新令牌无效或已过期，请重新登录', HttpStatus.UNAUTHORIZED);
    }
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new BusinessException(2002, '无效的刷新令牌', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) {
      throw new BusinessException(2001, '用户不存在或已注销', HttpStatus.UNAUTHORIZED);
    }
    const roles = payload.roles ?? [];
    return {
      accessToken: await this.signToken(user.id, roles, 'access'),
      refreshToken: await this.signToken(user.id, roles, 'refresh'),
      user: { id: user.id, displayName: user.displayName, avatarUrl: null },
      capabilities: capabilitiesFromRoles(roles),
    };
  }

  private async signToken(userId: string, roles: string[], type: 'access' | 'refresh'): Promise<string> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    return this.jwt.signAsync(
      { sub: userId, roles, type },
      {
        secret: jwtConfig.accessSecret,
        expiresIn: (type === 'access' ? jwtConfig.accessTtl : jwtConfig.refreshTtl) as JwtSignOptions['expiresIn'],
      },
    );
  }
}
