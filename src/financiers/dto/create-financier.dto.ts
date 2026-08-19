import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LoanOptionDto } from './loan-option.dto';

export class CreateFinancierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanOptionDto)
  loanOptions?: LoanOptionDto[];
}
