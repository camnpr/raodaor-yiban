import { IsOptional, IsString, Matches } from 'class-validator';

/** 创建会员购买意图（FR-M1）：tierCode 为本地权益等级码，金额由 IDStack 支付页锁定 */
export class CreateCheckoutDto {
  /** 目标权益等级（与 membership_benefits.tierCode 对齐，如 standard / premium） */
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, { message: '等级码非法' })
  tierCode!: string;

  /** 金额（字符串，单位元）；缺省由 IDStack 套餐目录决定，本地仅作展示 */
  @IsOptional()
  @IsString()
  amount?: string;

  /** 币种，默认 CNY */
  @IsOptional()
  @IsString()
  currency?: string;
}
