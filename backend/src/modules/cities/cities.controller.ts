import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthedRequestUser } from '../auth/jwt.types';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';

@Controller('cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  list(@CurrentUser() user: AuthedRequestUser) {
    return this.cities.list(user.userId);
  }

  @Post()
  add(@CurrentUser() user: AuthedRequestUser, @Body() dto: CreateCityDto) {
    return this.cities.add(user.userId, dto);
  }

  @Patch(':id/default')
  setDefault(@CurrentUser() user: AuthedRequestUser, @Param('id') id: string) {
    return this.cities.setDefault(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthedRequestUser, @Param('id') id: string) {
    return this.cities.remove(user.userId, id);
  }
}
