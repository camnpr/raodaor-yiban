import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** HTTP 状态码 → 分段错误码（附录 B） */
const STATUS_TO_BIZ_CODE: Record<number, number> = {
  400: 1001,
  401: 2001,
  403: 2003,
  404: 1004,
  409: 1009,
  429: 6001,
  500: 1000,
  501: 1000,
  502: 9000,
  503: 9000,
  504: 9000,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let bizCode = 1000;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'bizCode' in body) {
        bizCode = (body as { bizCode: number }).bizCode;
        message = (body as { message?: string }).message ?? exception.message;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        Array.isArray((body as { message?: unknown }).message)
      ) {
        // class-validator 校验失败
        bizCode = 1001;
        const messages = (body as { message: string[] }).message;
        message = Array.isArray(messages) ? messages.join('；') : String(messages);
      } else {
        bizCode = STATUS_TO_BIZ_CODE[status] ?? 1000;
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} [${bizCode}] ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status === 401) {
      // 401 属于客户端会话生命周期的预期事件（access 短 TTL 过期 → 前端静默续期后重放成功）
      this.logger.verbose(`${req.method} ${req.url} -> ${status} [${bizCode}] ${message}`);
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status} [${bizCode}] ${message}`);
    }

    res.status(status).json({ code: bizCode, data: null, message });
  }
}
