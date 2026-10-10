import { IsNotEmpty, IsString } from 'class-validator';

/** 补单前查询核销码状态（owner 角色，只读） */
export class CheckGrantDto {
  /** CheckoutSession.externalOrderId */
  @IsString()
  @IsNotEmpty()
  externalOrderId!: string;
}
