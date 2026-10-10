import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { BroadcastService } from './broadcast.service';
import { UpdateBroadcastSettingsDto } from './dto/update-broadcast-settings.dto';

/** 每日定时播报设置（FR-M4）：读取/更新均由 JWT 鉴权 */
@Controller('broadcast')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private readonly broadcast: BroadcastService) {}

  /** 当前用户的定时播报设置 + 权益资格 */
  @Get('settings')
  getSettings(@CurrentUser() user: AuthedRequestUser) {
    return this.broadcast.getSettings(user.userId);
  }

  /** 更新定时播报开关/时段（开启受会员权益限制） */
  @Post('settings')
  updateSettings(@CurrentUser() user: AuthedRequestUser, @Body() dto: UpdateBroadcastSettingsDto) {
    return this.broadcast.updateSettings(user.userId, dto);
  }
}
