import { apiFetch } from './api';

export interface MembershipBenefit {
  tierCode: string;
  cityLimit: number | null;
  careLimit: number;
  timedBroadcast: boolean;
  advancedWidget: boolean;
  dailyBrief: boolean;
  healthReport: boolean;
  emergencyContactLimit: number;
  aiCompanionQuota: number;
  priceMonthly: string;
}

export interface MyMembership {
  tier: string | null;
  expiresAt: string | null;
  isActive: boolean;
  benefit: MembershipBenefit;
  /** 用户时区（IANA） */
  timezone: string;
}

export interface CheckoutIntent {
  externalOrderId: string;
  tierCode: string;
  amount: string;
  currency: string;
  /** IDStack 支付页链接（服务端代下单后返回）；null 时回退到前端直达 URL */
  payUrl: string | null;
}

export interface CheckoutOrder {
  externalOrderId: string;
  targetPlan: string | null;
  amount: string;
  currency: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  idstackOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 会员权益阶梯（FR-M3） */
export function getMembershipPlans(): Promise<MembershipBenefit[]> {
  return apiFetch<MembershipBenefit[]>('/membership/plans');
}

/** 我的会员状态 + 生效权益（FR-M2/M4） */
export function getMyMembership(): Promise<MyMembership> {
  return apiFetch<MyMembership>('/membership/me');
}

/**
 * 创建会员购买意图 + 服务端代下单 IDStack（对齐 SnapCompress 契约）。
 * idstackAccessToken 仅用于后端代下单，不入库；缺省则回退到前端直达支付 URL。
 */
export function createCheckout(tierCode: string, idstackAccessToken?: string | null): Promise<CheckoutIntent> {
  return apiFetch<CheckoutIntent>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(idstackAccessToken ? { tierCode, idstackAccessToken } : { tierCode }),
  });
}

/** 我的购买意图 / 订单列表（用于支付后轮询核销状态，FR-M1） */
export function getMyOrders(): Promise<CheckoutOrder[]> {
  return apiFetch<CheckoutOrder[]>('/billing/orders');
}

export interface BroadcastSettings {
  enabled: boolean;
  time: string | null;
  /** 当前会员等级是否包含「每日定时播报」权益 */
  entitled: boolean;
}

/** 我的定时播报设置 + 权益资格（FR-M4） */
export function getBroadcastSettings(): Promise<BroadcastSettings> {
  return apiFetch<BroadcastSettings>('/broadcast/settings');
}

/** 更新定时播报开关/时段（FR-M4） */
export function updateBroadcastSettings(input: { enabled: boolean; time?: string }): Promise<BroadcastSettings> {
  return apiFetch<BroadcastSettings>('/broadcast/settings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** 更新用户时区（IANA），FR-M4 定时播报按时区换算 */
export function updateTimezone(timezone: string): Promise<{ timezone: string }> {
  return apiFetch<{ timezone: string }>('/membership/timezone', {
    method: 'POST',
    body: JSON.stringify({ timezone }),
  });
}
