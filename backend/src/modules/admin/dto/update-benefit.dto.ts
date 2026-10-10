import { IsBoolean, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

/**
 * 运营维护「等级 → 权益」映射（FR-M3，仅 owner 角色）。
 * 仅 tierCode 同名行可改；priceMonthly 由代码权威价维护（DB 无此列），不可经此修改。
 */
export class UpdateBenefitDto {
  /** 城市收藏上限；null = 不限（尊享会员） */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  cityLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  careLimit?: number;

  @IsOptional()
  @IsBoolean()
  timedBroadcast?: boolean;

  @IsOptional()
  @IsBoolean()
  advancedWidget?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyBrief?: boolean;

  @IsOptional()
  @IsBoolean()
  healthReport?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  emergencyContactLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiCompanionQuota?: number;
}
