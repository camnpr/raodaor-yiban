import { SetMetadata } from '@nestjs/common';

/** 角色元数据键（由 RolesGuard 读取） */
export const ROLES_KEY = 'roles';

/**
 * 标记接口所需 IDStack 角色（JWT `roles` claim 为唯一权威，见 jwt.types）。
 * 例：@Roles('owner') 仅平台拥有者可访问；@Roles('system_admin', 'owner') 运营可访问。
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
