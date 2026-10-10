import { IsString, Length } from 'class-validator';

/** 更新用户时区（IANA，如 Asia/Shanghai），FR-M4 定时播报按时区换算 */
export class UpdateTimezoneDto {
  @IsString()
  @Length(1, 64)
  timezone!: string;
}
