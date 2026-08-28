import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSelfDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  office?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
