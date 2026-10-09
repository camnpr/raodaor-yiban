import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** IDStack 授权码（一次性，10 分钟有效） */
  @IsString()
  @IsNotEmpty()
  code!: string;

  /** 发起授权时使用的 redirect_uri（须与 IDStack 应用白名单字节级一致） */
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}
