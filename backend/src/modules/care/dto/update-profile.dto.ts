import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** 长辈轻量档案更新（出生年份 / 守护城市 / 备注，FR-C4） */
export class UpdateProfileDto {
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2020)
  birthYear?: number;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  @Max(200)
  note?: string;
}
