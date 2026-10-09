import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCityDto {
  /** QWeather LocationID */
  @IsString()
  @IsNotEmpty()
  cityId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  /** 行政区划（省/市，展示用） */
  @IsString()
  @IsOptional()
  adminDiv?: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}
