import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { CreateCityDto } from './dto/create-city.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.favoriteCity.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async add(userId: string, dto: CreateCityDto) {
    const existing = await this.prisma.favoriteCity.findUnique({
      where: { userId_cityId: { userId, cityId: dto.cityId } },
    });
    if (existing) {
      throw new BusinessException(3002, '该城市已在收藏列表', HttpStatus.CONFLICT);
    }
    const count = await this.prisma.favoriteCity.count({ where: { userId } });
    return this.prisma.favoriteCity.create({
      data: {
        userId,
        cityId: dto.cityId,
        name: dto.name,
        adminDiv: dto.adminDiv,
        lat: dto.lat,
        lng: dto.lng,
        // 首个收藏自动设为默认城市
        isDefault: count === 0,
        sortOrder: count,
      },
    });
  }

  async setDefault(userId: string, id: string) {
    const city = await this.prisma.favoriteCity.findFirst({ where: { id, userId } });
    if (!city) {
      throw new BusinessException(3003, '城市不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.$transaction([
      this.prisma.favoriteCity.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.favoriteCity.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.list(userId);
  }

  async remove(userId: string, id: string) {
    const city = await this.prisma.favoriteCity.findFirst({ where: { id, userId } });
    if (!city) {
      throw new BusinessException(3003, '城市不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.favoriteCity.delete({ where: { id } });
    // 删除默认城市后，顺延第一个剩余城市为默认
    if (city.isDefault) {
      const first = await this.prisma.favoriteCity.findFirst({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
      });
      if (first) {
        await this.prisma.favoriteCity.update({ where: { id: first.id }, data: { isDefault: true } });
      }
    }
    return this.list(userId);
  }
}
