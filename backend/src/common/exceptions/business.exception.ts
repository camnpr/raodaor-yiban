import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常：携带分段错误码（附录 B：1xxx 通用 / 2xxx 认证 / 9xxx 生态依赖 等），
 * 响应体统一为 { code, data: null, message }。
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly bizCode: number,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ bizCode, message }, status);
  }
}
