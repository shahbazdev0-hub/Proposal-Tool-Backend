import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { WaterType } from '../../common/enums/water-type.enum';
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

  // Required for Homewater packages (flat rep commission); ignored for Supreme.
  @ValidateIf((dto: CreatePackageDto) => dto.waterType === WaterType.HOMEWATER)
  @IsNumber()
  @Min(0)
  repCommissionFlat?: number;

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
  @IsNumber()
  @Min(0)
  maxMargin?: number;
}
