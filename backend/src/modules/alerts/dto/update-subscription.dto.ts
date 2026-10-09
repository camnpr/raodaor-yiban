import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/** 预警级别阈值：Minor=蓝 / Moderate=黄 / Severe=橙 / Extreme=红（订阅 >= 该级别的预警） */
export const ALERT_LEVELS = ['Minor', 'Moderate', 'Severe', 'Extreme'] as const;

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  cityId?: string;

  @IsIn(ALERT_LEVELS)
  @IsOptional()
  minLevel?: string;

  @IsString()
  @IsOptional()
  quietStart?: string;

  @IsString()
  @IsOptional()
  quietEnd?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
