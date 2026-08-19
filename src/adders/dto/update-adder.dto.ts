import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAdderDto } from './create-adder.dto';

export class UpdateAdderDto extends PartialType(CreateAdderDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
