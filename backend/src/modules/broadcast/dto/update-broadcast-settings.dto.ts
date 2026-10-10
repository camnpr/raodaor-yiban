import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/** 更新每日定时播报设置（FR-M4）：开关 + 时段。仅会员权益可用。 */
export class UpdateBroadcastSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  /** 播报时段（Asia/Shanghai HH:mm）；开启时必须提供 */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '时段须为 HH:mm' })
  time?: string;
}
