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
}

export interface MyMembership {
  tier: string | null;
  expiresAt: string | null;
  isActive: boolean;
  benefit: MembershipBenefit;
}

export interface CheckoutIntent {
  externalOrderId: string;
  tierCode: string;
  amount: string;
  currency: string;
}

/** 会员权益阶梯（FR-M3） */
export function getMembershipPlans(): Promise<MembershipBenefit[]> {
  return apiFetch<MembershipBenefit[]>('/membership/plans');
}

/** 我的会员状态 + 生效权益（FR-M2/M4） */
export function getMyMembership(): Promise<MyMembership> {
  return apiFetch<MyMembership>('/membership/me');
}

/** 创建会员购买意图，返回 externalOrderId 供嵌入 IDStack 支付（FR-M1） */
export function createCheckout(tierCode: string, amount?: string): Promise<CheckoutIntent> {
  return apiFetch<CheckoutIntent>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(amount ? { tierCode, amount } : { tierCode }),
  });
}
