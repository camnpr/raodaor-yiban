import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Observable, map } from 'rxjs';

/** 统一成功响应包装：{ code: 0, data, message: 'ok' }（对齐生态结构） */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { code: number; data: T; message: string }> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<{ code: number; data: T; message: string }> {
    return next.handle().pipe(map((data) => ({ code: 0, data, message: 'ok' })));
  }
}
