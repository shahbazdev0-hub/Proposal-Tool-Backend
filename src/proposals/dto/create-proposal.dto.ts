import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProposalAdderDto {
  @IsMongoId()
  adderId: string;

  // Only meaningful for a dynamic adder — the price the rep chose within its
  // allowed range. Omitted/ignored for a static adder, which always prices
  // at the catalog value.
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class CreateProposalDto {
  @IsMongoId()
  customerId: string;

  @IsString()
  waterType: string;

  @IsMongoId()
  packageId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalAdderDto)
  adders?: ProposalAdderDto[];

  @IsNumber()
  @Min(0)
  salesMargin: number;

  @IsOptional()
  @IsMongoId()
  financierId?: string;

  @IsOptional()
  @IsMongoId()
  loanOptionId?: string;
}
