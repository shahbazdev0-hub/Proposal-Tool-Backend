import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAdderDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsEnum(['static', 'dynamic'])
  pricingMode?: 'static' | 'dynamic';

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxExtra?: number | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  applicablePackageIds?: string[];
}
