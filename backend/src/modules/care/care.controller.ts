import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { CareService } from './care.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('care')
@UseGuards(JwtAuthGuard)
export class CareController {
  constructor(private readonly care: CareService) {}

  /** 守护人生成邀请码 */
  @Post('invite')
  invite(@CurrentUser() user: AuthedRequestUser) {
    return this.care.createInvite(user.userId);
  }

  /** 长辈凭邀请码确认绑定 */
  @Post('accept')
  accept(@CurrentUser() user: AuthedRequestUser, @Body() dto: AcceptInviteDto) {
    return this.care.acceptInvite(user.userId, dto.code);
  }

  /** 当前用户的关系列表（区分守护人 / 长辈视角） */
  @Get('relationships')
  relationships(@CurrentUser() user: AuthedRequestUser) {
    return this.care.listRelationships(user.userId);
  }

  /** 解除绑定 */
  @Delete(':id')
  remove(@CurrentUser() user: AuthedRequestUser, @Param('id') id: string) {
    return this.care.removeRelationship(user.userId, id);
  }

  /** 守护中心：绑定长辈列表 + 天气摘要 */
  @Get('elders')
  elders(@CurrentUser() user: AuthedRequestUser) {
    return this.care.listElders(user.userId);
  }

  /** 长辈详情天气 */
  @Get('elders/:id/weather')
  elderWeather(@CurrentUser() user: AuthedRequestUser, @Param('id') id: string) {
    return this.care.getElderWeather(user.userId, id);
  }

  /** 长辈轻量档案 */
  @Get('profile')
  profile(@CurrentUser() user: AuthedRequestUser) {
    return this.care.getProfile(user.userId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthedRequestUser, @Body() dto: UpdateProfileDto) {
    return this.care.updateProfile(user.userId, dto);
  }
}
