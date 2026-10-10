import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { MembershipService } from './membership.service';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';

@Controller('membership')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}

  /** 权益阶梯（FR-M3）：免费 / 标准 / 尊享 的权益对照 */
  @Get('plans')
  plans() {
    return this.membership.getPlans();
  }

  /** 我的会员状态 + 生效权益（FR-M2/M4） */
  @Get('me')
  me(@CurrentUser() user: AuthedRequestUser) {
    return this.membership.getMyMembership(user.userId);
  }

  /** 更新用户时区（FR-M4 定时播报按时区换算） */
  @Post('timezone')
  updateTimezone(@CurrentUser() user: AuthedRequestUser, @Body() dto: UpdateTimezoneDto) {
    return this.membership.updateTimezone(user.userId, dto.timezone);
  }
}
