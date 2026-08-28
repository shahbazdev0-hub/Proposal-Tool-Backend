import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProposalDto {
  @IsMongoId()
  customerId: string;

  @IsString()
  waterType: string;

  @IsMongoId()
  packageId: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  adderIds?: string[];

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
