import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';

/** 用户列表查询（支持关键字：昵称 / IDStack 用户Id / 本平台 userId） */
export class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

/** 亲情关系列表查询 */
export class CareQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  elderUserId?: string;

  @IsOptional()
  @IsString()
  guardianUserId?: string;
}

/** 订阅订单列表查询 */
export class OrdersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

/** 审计日志列表查询 */
export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
