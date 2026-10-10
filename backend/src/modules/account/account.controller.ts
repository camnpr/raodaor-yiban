import { Body, Controller, Delete, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { AccountService } from './account.service';
import { UpdateLocaleDto } from './dto/update-locale.dto';

/** 账号合规（PRD §7.2）：语言偏好 + 账号注销，均需登录 */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Put('locale')
  updateLocale(@CurrentUser() user: AuthedRequestUser, @Body() dto: UpdateLocaleDto) {
    return this.account.updateLocale(user.userId, dto.locale);
  }

  @Delete('deactivate')
  deactivate(@CurrentUser() user: AuthedRequestUser) {
    return this.account.deactivate(user.userId);
  }
}
