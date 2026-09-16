import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class LoanOptionDto {
  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  dealerFeePercent: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  loanTerm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentFactor?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
