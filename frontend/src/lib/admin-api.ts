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

// ---------- 运营后台 · 概览 / 列表 / 配置（PRD §8 / Phase 2） ----------

/** 统一分页响应（与后端 Paged<T> 对齐） */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 概览统计：用户数 / 亲情关系数 / 活跃会员数 / 预警事件量 / 会员营收 */
export interface AdminOverview {
  users: number;
  careRelations: number;
  activeMembers: number;
  alertEvents: number;
  membershipRevenue: number;
}

export function getOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>('/admin/overview');
}

/** 用户精简信息（列表用） */
export interface UserLite {
  id: string;
  displayName: string;
  locale: string;
  membershipTier: string | null;
  membershipExpiresAt: string | null;
  createdAt: string;
}

/** 用户详情（详情页用） */
export interface UserDetail extends UserLite {
  timezone: string;
  careCount: number;
  cityCount: number;
  elderProfile: { birthYear: number | null; cityName: string | null; note: string | null } | null;
}

export interface ListUsersQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export function listUsers(query: ListUsersQuery = {}): Promise<Paged<UserLite>> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<Paged<UserLite>>(`/admin/users${qs ? `?${qs}` : ''}`);
}

export function getUser(id: string): Promise<UserDetail> {
  return apiFetch<UserDetail>(`/admin/users/${encodeURIComponent(id)}`);
}

/** 亲情关系（列表用） */
export interface CareRelation {
  id: string;
  elderUserId: string;
  guardianUserId: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  role: string | null;
  note: string | null;
  createdAt: string;
  elder: { displayName: string | null };
  guardian: { displayName: string | null };
}

export interface ListCareQuery {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listCareRelations(query: ListCareQuery = {}): Promise<Paged<CareRelation>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<Paged<CareRelation>>(`/admin/care/relations${qs ? `?${qs}` : ''}`);
}

/** 订阅订单（列表用） */
export interface CheckoutOrder {
  id: string;
  externalOrderId: string | null;
  subjectType: string;
  subjectId: string;
  targetPlan: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  grantedAt: string | null;
  createdAt: string;
}

export interface ListOrdersQuery {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listOrders(query: ListOrdersQuery = {}): Promise<Paged<CheckoutOrder>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<Paged<CheckoutOrder>>(`/admin/membership/orders${qs ? `?${qs}` : ''}`);
}

/** 权益映射（与后端 MembershipBenefitVo 对齐） */
export interface MembershipPlan {
  tierCode: string;
  cityLimit: number | null;
  careLimit: number;
  timedBroadcast: boolean;
  advancedWidget: boolean;
  dailyBrief: boolean;
  healthReport: boolean;
  emergencyContactLimit: number;
  aiCompanionQuota: number;
  /** 月费（代码权威价，DB 无此列，不可经后台修改） */
  priceMonthly: string;
}

export function getBenefits(): Promise<MembershipPlan[]> {
  return apiFetch<MembershipPlan[]>('/admin/membership/benefits');
}

export interface UpdateBenefitInput {
  cityLimit?: number | null;
  careLimit?: number;
  timedBroadcast?: boolean;
  advancedWidget?: boolean;
  dailyBrief?: boolean;
  healthReport?: boolean;
  emergencyContactLimit?: number;
  aiCompanionQuota?: number;
}

/** 更新权益映射（owner 专属，高危全局配置） */
export function updateBenefit(tierCode: string, patch: UpdateBenefitInput): Promise<MembershipPlan> {
  return apiFetch<MembershipPlan>(`/admin/membership/benefits/${encodeURIComponent(tierCode)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/** 审计日志（列表用） */
export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface ListAuditQuery {
  action?: string;
  actorId?: string;
  targetType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function listAuditLogs(query: ListAuditQuery = {}): Promise<Paged<AuditLog>> {
  const params = new URLSearchParams();
  if (query.action) params.set('action', query.action);
  if (query.actorId) params.set('actorId', query.actorId);
  if (query.targetType) params.set('targetType', query.targetType);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<Paged<AuditLog>>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
}

/** 预警事件大屏嵌入描述（DataCanvas） */
export interface AlertEmbed {
  embedUrl: string;
  apiKey: string;
  signed: boolean;
}

export function getAlertEmbed(): Promise<AlertEmbed> {
  return apiFetch<AlertEmbed>('/admin/alerts/embed');
}
