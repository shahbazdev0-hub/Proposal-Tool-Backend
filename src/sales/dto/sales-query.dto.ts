import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class SalesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsMongoId()
  salesRep?: string;
}
