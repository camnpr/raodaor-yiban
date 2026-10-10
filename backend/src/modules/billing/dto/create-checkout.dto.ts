import { IsOptional, IsString, Matches } from 'class-validator';

/** 创建会员购买意图（FR-M1）：tierCode 为本地权益等级码，金额由服务端权威价决定 */
export class CreateCheckoutDto {
  /** 目标权益等级（与 membership_benefits.tierCode 对齐，如 standard / premium） */
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, { message: '等级码非法' })
  tierCode!: string;

  /** 用户在 IDStack 的 access_token（仅用于服务端代下单，不入库；缺省回退到旧版 URL 跳转） */
  @IsOptional()
  @IsString()
  idstackAccessToken?: string;

  /** 币种，默认 CNY */
  @IsOptional()
  @IsString()
  currency?: string;
}
