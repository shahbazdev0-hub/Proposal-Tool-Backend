import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { WaterType } from '../../common/enums/water-type.enum';

export class CreateSaleDto {
  @IsString()
  customerName: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsDateString()
  saleDate: string;

  @IsOptional()
  @IsDateString()
  installDate?: string;

  // Omit financier/loanOptionId entirely for a cash sale (dealer fee defaults to 0).
  @IsOptional()
  @IsMongoId()
  financier?: string;

  @ValidateIf((dto: CreateSaleDto) => !!dto.financier)
  @IsMongoId()
  loanOptionId?: string;

  @IsNumber()
  @Min(0)
  loanAmount: number;

  @IsEnum(WaterType)
  waterType: WaterType;

  @IsMongoId()
  package: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  adders?: string[];

  @IsMongoId()
  salesRep: string;
}
