import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PackageOverridesDto } from './package-overrides.dto';

export class CreatePackageDto {
  @IsOptional()
  @IsString()
  productType?: string;

  @IsString()
  waterType: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @ValidateNested()
  @Type(() => PackageOverridesDto)
  overrides: PackageOverridesDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nickOverride?: number;

  @IsOptional()
  @IsString({ each: true })
  inclusions?: string[];

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsEnum(['static', 'dynamic'])
  pricingMode?: 'static' | 'dynamic';

  @IsOptional()
  @IsEnum(['flat', 'percent'])
  maxMarginType?: 'flat' | 'percent';

  /** Dynamic only. null = inherit the product-level ceiling (always flat $). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxMarginValue?: number | null;

  @IsOptional()
  @IsEnum(['flat', 'percent'])
  repCommissionType?: 'flat' | 'percent';

  /** Static only — flat $ or percent Sales Rep commission. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  repCommissionValue?: number | null;
}
