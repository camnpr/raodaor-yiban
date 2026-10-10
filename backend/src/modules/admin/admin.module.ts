import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MembershipModule } from '../membership/membership.module';

@Module({
  controllers: [AdminController],
  imports: [MembershipModule],
  providers: [AdminService],
})
export class AdminModule {}
