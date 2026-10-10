import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipService } from '../membership/membership.service';
import { AdminService } from './admin.service';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { GrantMembershipDto } from './dto/grant-membership.dto';
import { CheckGrantDto } from './dto/check-grant.dto';
import { UpdateBenefitDto } from './dto/update-benefit.dto';
import {
  UsersQueryDto,
  CareQueryDto,
  OrdersQueryDto,
  AuditQueryDto,
} from './dto/queries.dto';

/**
 * 运营后台接口（PRD §8 / Phase 1）。
 * 看板/列表类（概览 / 用户 / 亲情 / 会员 / 审计 / 预警）：consoleAdmin（system_admin | owner）。
 * 高危写操作（补单 / 权益映射更新）：owner 专属。
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly membership: MembershipService,
    private readonly admin: AdminService,
  ) {}

  /** 概览看板 */
  @Get('overview')
  @Roles('system_admin', 'owner')
  overview() {
    return this.admin.overview();
  }

  /** 用户与长辈档案列表（分页 + 关键字） */
  @Get('users')
  @Roles('system_admin', 'owner')
  listUsers(@Query() query: UsersQueryDto) {
    return this.admin.listUsers(query);
  }

  /** 用户详情（含亲情/收藏计数与长辈档案） */
  @Get('users/:id')
  @Roles('system_admin', 'owner')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  /** 亲情关系列表 */
  @Get('care/relations')
  @Roles('system_admin', 'owner')
  listCareRelations(@Query() query: CareQueryDto) {
    return this.admin.listCareRelations(query);
  }

  /** 会员订阅订单列表 */
  @Get('membership/orders')
  @Roles('system_admin', 'owner')
  listOrders(@Query() query: OrdersQueryDto) {
    return this.admin.listOrders(query);
  }

  /** 权益映射（FR-M3）：读取阶梯 */
  @Get('membership/benefits')
  @Roles('system_admin', 'owner')
  getBenefits() {
    return this.admin.getBenefits();
  }

  /** 权益映射（FR-M3）：更新（owner 专属，高危全局配置） */
  @Put('membership/benefits/:tierCode')
  @Roles('owner')
  updateBenefit(@Param('tierCode') tierCode: string, @Body() dto: UpdateBenefitDto) {
    return this.admin.updateBenefit(tierCode, dto);
  }

  /** 审计日志列表 */
  @Get('audit-logs')
  @Roles('system_admin', 'owner')
  listAuditLogs(@Query() query: AuditQueryDto) {
    return this.admin.listAuditLogs(query);
  }

  /** 预警事件大屏嵌入描述（DataCanvas） */
  @Get('alerts/embed')
  @Roles('system_admin', 'owner')
  getAlertEmbed(@CurrentUser() operator: AuthedRequestUser) {
    return this.admin.getAlertEmbed(operator.userId);
  }

  /** 补单前查询核销码状态（owner 专属，只读） */
  @Get('membership/grant/check')
  @Roles('owner')
  checkGrant(@Query() dto: CheckGrantDto) {
    return this.membership.checkGrant(dto.externalOrderId);
  }

  /** 运营手动补单（owner 专属） */
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
