import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** 运营手动补单（owner 角色）：为已付款但 webhook 未同步的用户补发会员 */
export class GrantMembershipDto {
  /** 本平台用户 id（与 idstackUserId 二选一） */
  @IsOptional()
  @IsString()
  userId?: string;

  /** IDStack 用户主键（与 userId 二选一） */
  @IsOptional()
  @IsString()
  idstackUserId?: string;

  /** 目标等级：standard / premium（免费 free 不可经此补发） */
  @IsString()
  @Matches(/^(standard|premium)$/, { message: '仅支持 standard / premium' })
  tierCode!: string;

  /** 时长（月），默认 1，上限 120（防滥用） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  months?: number;

  /** 关联本地意图单 externalOrderId（补单后标记 VERIFIED，便于对账） */
  @IsOptional()
  @IsString()
  externalOrderId?: string;

  /** 运营备注（写入审计日志） */
  @IsOptional()
  @IsString()
  note?: string;
}
