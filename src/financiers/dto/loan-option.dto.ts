import { IsNumber, IsString, Max, Min } from 'class-validator';

export class LoanOptionDto {
  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  dealerFeePercent: number;
}
