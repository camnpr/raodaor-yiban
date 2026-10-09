import { IsNotEmpty, IsString } from 'class-validator';

export class LocationQueryDto {
  @IsString()
  @IsNotEmpty()
  lon!: string;

  @IsString()
  @IsNotEmpty()
  lat!: string;
}

export class SearchCityQueryDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;
}
