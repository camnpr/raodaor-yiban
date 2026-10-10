import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 本地维护的「等级 → 权益」映射（FR-M3）；IDStack 仅托管套餐目录与收款。 */
interface BenefitSeed {
  tierCode: string;
  cityLimit: number | null;
  careLimit: number;
  timedBroadcast: boolean;
  advancedWidget: boolean;
  dailyBrief: boolean;
  healthReport: boolean;
  emergencyContactLimit: number;
  aiCompanionQuota: number;
  /** 月费（元，字符串）；free=0 不可购；运营改价时同步更新此处（或由 IDStack 套餐目录覆盖） */
  priceMonthly: string;
}

/** 默认权益阶梯（运营可经 DB 直接覆盖 tierCode 同名的行；priceMonthly 仍由代码维护，避免重复迁移） */
const DEFAULT_BENEFITS: BenefitSeed[] = [
  { tierCode: 'free', cityLimit: 3, careLimit: 1, timedBroadcast: false, advancedWidget: false, dailyBrief: false, healthReport: false, emergencyContactLimit: 1, aiCompanionQuota: 0, priceMonthly: '0.00' },
  { tierCode: 'standard', cityLimit: 10, careLimit: 3, timedBroadcast: true, advancedWidget: true, dailyBrief: false, healthReport: false, emergencyContactLimit: 3, aiCompanionQuota: 0, priceMonthly: '12.00' },
  { tierCode: 'premium', cityLimit: null, careLimit: 10, timedBroadcast: true, advancedWidget: true, dailyBrief: true, healthReport: true, emergencyContactLimit: 5, aiCompanionQuota: 50, priceMonthly: '30.00' },
];

/** 各等级月费（服务端权威价，checkout 以此为准，覆盖前端传入，防止篡改） */
export const TIER_PRICES: Record<string, { amount: string; currency: string }> = Object.fromEntries(
  DEFAULT_BENEFITS.map((b) => [b.tierCode, { amount: b.priceMonthly, currency: 'CNY' }]),
);

export interface MembershipBenefitVo {
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

export interface MyMembershipVo {
  tier: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  benefit: MembershipBenefitVo;
}

/** 未知（非 free）等级一律按最高权益解锁，避免 IDStack 等级码与本地映射暂时不一致时会员权益失效 */
function premiumDefaults(): BenefitSeed {
  return DEFAULT_BENEFITS[DEFAULT_BENEFITS.length - 1];
}

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 首次调用时幂等补齐默认权益阶梯（运营可在 DB 中覆盖同名 tierCode） */
  private async ensureSeeded(): Promise<void> {
    for (const seed of DEFAULT_BENEFITS) {
      await this.prisma.membershipBenefit.upsert({
        where: { tierCode: seed.tierCode },
        create: seed,
        update: {},
      }).catch((err) => this.logger.warn(`权益种子 ${seed.tierCode} 写入跳过：${err instanceof Error ? err.message : String(err)}`));
    }
  }

  /** 全部权益阶梯（供前端套餐页展示，FR-M3）；priceMonthly 由代码权威价覆盖（DB 无此列） */
  async getPlans(): Promise<MembershipBenefitVo[]> {
    await this.ensureSeeded();
    const rows = await this.prisma.membershipBenefit.findMany({ orderBy: { tierCode: 'asc' } });
    return rows.map((r) => {
      const vo = this.toVo(r);
      vo.priceMonthly = this.findSeed(r.tierCode).priceMonthly;
      return vo;
    });
  }

  /** 按等级取权益；null=免费（取 free）；未知付费等级=最高权益兜底 */
  async getEffectiveBenefit(tierCode: string | null): Promise<MembershipBenefitVo> {
    if (!tierCode) return this.toVo(this.findSeed('free'));
    const row = await this.prisma.membershipBenefit.findUnique({ where: { tierCode } });
    if (row) return this.toVo(row);
    // 本地无该等级映射：视为已购会员，按最高权益解锁
    this.logger.warn(`未找到等级 ${tierCode} 的本地权益映射，按最高权益兜底`);
    return this.toVo(premiumDefaults());
  }

  /** 当前用户会员状态 + 生效权益（FR-M2/M4） */
  async getMyMembership(userId: string): Promise<MyMembershipVo> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const tier = user?.membershipTier ?? null;
    const expiresAt = user?.membershipExpiresAt ?? null;
    const isActive = !!expiresAt && expiresAt.getTime() > Date.now();
    return {
      tier: isActive ? tier : null,
      expiresAt: isActive ? expiresAt : null,
      isActive,
      benefit: await this.getEffectiveBenefit(isActive ? tier : null),
    };
  }

  private findSeed(tierCode: string): BenefitSeed {
    return DEFAULT_BENEFITS.find((s) => s.tierCode === tierCode) ?? premiumDefaults();
  }

  private toVo(r: {
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
  }): MembershipBenefitVo {
    return {
      tierCode: r.tierCode,
      cityLimit: r.cityLimit,
      careLimit: r.careLimit,
      timedBroadcast: r.timedBroadcast,
      advancedWidget: r.advancedWidget,
      dailyBrief: r.dailyBrief,
      healthReport: r.healthReport,
      emergencyContactLimit: r.emergencyContactLimit,
      aiCompanionQuota: r.aiCompanionQuota,
      priceMonthly: r.priceMonthly,
    };
  }
}
