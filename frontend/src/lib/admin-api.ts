import { apiFetch } from './api';

export interface GrantMembershipInput {
  /** 本平台用户 id（与目标用户一致，后端会校验核销码所属用户） */
  userId: string;
  /** 目标等级：standard / premium */
  tierCode: string;
  /** 时长（月） */
  months: number;
  /** 已核销的核销码（CheckoutSession.externalOrderId） */
  externalOrderId: string;
  /** 补单原因（选填，记入审计） */
  note?: string;
}

export interface GrantMembershipResult {
  userId: string;
  tierCode: string;
  /** ISO 字符串 */
  expiresAt: string;
  isActive: boolean;
}

/** 运营手动补单（owner 角色，后端二次鉴权；核销码须已核销且不可重复） */
export function grantMembership(input: GrantMembershipInput): Promise<GrantMembershipResult> {
  return apiFetch<GrantMembershipResult>('/admin/membership/grant', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface GrantCheckResult {
  externalOrderId: string;
  exists: boolean;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | null;
  granted: boolean;
  subjectUserId: string | null;
  targetPlan: string | null;
  amount: string | null;
  /** 是否可补单：已核销且未补单 */
  eligible: boolean;
}

/** 补单前查询核销码状态（owner 角色，只读）；真正的校验仍以 grant 为准 */
export function checkGrant(externalOrderId: string): Promise<GrantCheckResult> {
  return apiFetch<GrantCheckResult>(
    `/admin/membership/grant/check?externalOrderId=${encodeURIComponent(externalOrderId)}`,
  );
}
