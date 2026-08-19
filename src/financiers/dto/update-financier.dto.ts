import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateFinancierDto } from './create-financier.dto';

export class UpdateFinancierDto extends PartialType(CreateFinancierDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
