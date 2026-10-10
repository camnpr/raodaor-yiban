/** 本平台 JWT 载荷（SSO 换发；roles 来自 IDStack JWT，是唯一权威） */
export interface PlatformJwtPayload {
  /** 本平台 User.id */
  sub: string;
  roles: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * IDStack access_token 的 `roles` claim 元素。
 * IDStack 签发的形态是对象数组：`[{ role_id, role_name, tenant_id, app_id }]`（见 IDStack 文档「角色与权限」）。
 */
export interface IdstackRoleClaim {
  role_id?: string;
  role_name?: string;
  /** 兼容部分部署用 role / name 表达角色名 */
  role?: string;
  name?: string;
  tenant_id?: string;
  /** 空串 = 租户级（对该租户下所有应用生效）；非空 = 应用级（仅该 app 生效） */
  app_id?: string;
}

/**
 * IDStack JWT 载荷（以 JWKS 公钥（RS256）验签后读取；roles 为唯一权威角色来源）。
 *
 * ⚠️ 用户主键 claim 名是 `id`，**不是** OIDC 标准的 `sub`。
 * `sub` 只出现在 `GET /api/v1/oauth/userinfo` 的响应体里（值同为 `user.id`），JWT 内不存在。
 */
export interface IdstackJwtClaims {
  /** IDStack 用户主键（= 本平台 `User.idstackUserId`，也是 webhook 载荷里的 userId） */
  id?: string;
  /** 兼容 OIDC 语义的兜底（IDStack 当前不下发，仅防御性保留） */
  sub?: string;
  /** IDStack 下发的展示名 claim */
  user_name?: string;
  /** 对象数组为主；同时兼容纯字符串数组（不同部署形态） */
  roles?: Array<IdstackRoleClaim | string>;
  name?: string;
  nickname?: string;
  preferred_username?: string;
}

/** 挂到 req.user 上的请求上下文 */
export interface AuthedRequestUser {
  userId: string;
  roles: string[];
}

/**
 * 能力布尔：入口可见性一律由 `/auth/me` 下发，前端禁止硬编码角色名。
 * - `consoleAdmin` —— 平台运营后台（IDStack `system_admin` / `owner` 角色驱动）。
 * - `owner` —— 平台拥有者（仅 IDStack `owner` 角色），运营补单等高危操作专属。
 * 长辈 / 守护人不依赖 IDStack 业务角色区分（二者可互为、可并存），
 * 视图由亲情关系数据（CareRelationship）驱动。
 */
export interface Capabilities {
  consoleAdmin: boolean;
  /** 平台拥有者：仅 owner 角色为 true（system_admin 为 false），用于展示/启用高危运营操作 */
  owner: boolean;
}
