import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipService } from '../membership/membership.service';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { GrantMembershipDto } from './dto/grant-membership.dto';
import { CheckGrantDto } from './dto/check-grant.dto';

/**
 * 运营后台接口（平台拥有者 owner 角色）。
 * 当前仅手动补单一项；后续可在此扩展其它运营操作。
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly membership: MembershipService) {}

  /**
   * 补单前查询核销码状态（仅 owner 角色，只读）。
   * 供前端在提交前展示：是否已核销、是否已补单、所属用户等；真正的校验仍以 grant 为准。
   */
  @Get('membership/grant/check')
  @Roles('owner')
  checkGrant(@Query() dto: CheckGrantDto) {
    return this.membership.checkGrant(dto.externalOrderId);
  }

  /**
   * 运营手动补单（仅 owner 角色）。
   * 为已付款但 webhook 未同步的用户补发会员；顺延已有会员期；关联意图单标 VERIFIED；写审计。
   */
  @Post('membership/grant')
  @Roles('owner')
  grant(@CurrentUser() operator: AuthedRequestUser, @Body() dto: GrantMembershipDto) {
    return this.membership.grantMembership({
      operatorId: operator.userId,
      userId: dto.userId,
      idstackUserId: dto.idstackUserId,
      tierCode: dto.tierCode,
      months: dto.months ?? 1,
      externalOrderId: dto.externalOrderId,
      note: dto.note,
    });
  }
}
