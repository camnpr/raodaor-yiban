import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** 分页基础查询（运营后台列表通用；仓库此前无分页约定，此处统一引入） */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 页码 → Prisma skip（页码下限 1） */
export function pageSkip(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, pageSize);
}

/** 组装统一分页响应（与全局成功信封兼容） */
export function paged<T>(items: T[], total: number, page: number, pageSize: number): Paged<T> {
  return {
    items,
    total,
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
  };
}
