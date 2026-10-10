import { IsIn } from 'class-validator';

/** 账号合规：用户语言偏好（zh-CN / zh-TW），与服务端 locale 保持一致 */
export class UpdateLocaleDto {
  @IsIn(['zh-CN', 'zh-TW'])
  locale!: string;
}
