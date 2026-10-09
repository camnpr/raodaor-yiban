import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** 创建会员购买意图（FR-M1）：返回 externalOrderId 供前端嵌入 IDStack payment-create */
  @Post('checkout')
  checkout(@CurrentUser() user: AuthedRequestUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.userId, dto);
  }

  /** 我的购买意图 / 订单（FR-M1） */
  @Get('orders')
  orders(@CurrentUser() user: AuthedRequestUser) {
    return this.billing.listOrders(user.userId);
  }
}
