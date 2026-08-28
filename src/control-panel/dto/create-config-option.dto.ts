import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateConfigOptionDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
