import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { AlertsService } from './alerts.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('subscription')
  getSubscription(@CurrentUser() user: AuthedRequestUser) {
    return this.alerts.getSubscription(user.userId);
  }

  @Put('subscription')
  upsertSubscription(@CurrentUser() user: AuthedRequestUser, @Body() dto: UpdateSubscriptionDto) {
    return this.alerts.upsertSubscription(user.userId, dto);
  }
}
