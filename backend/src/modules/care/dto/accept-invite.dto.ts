import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/** 长辈凭邀请码确认绑定（FR-C1） */
export class AcceptInviteDto {
  /** 守护人分享的邀请码（8 位大小写字母+数字） */
  @IsString()
  @IsNotEmpty()
  @Length(6, 24)
  @Matches(/^[A-Za-z0-9]+$/, { message: '邀请码格式非法' })
  code: string;
}
