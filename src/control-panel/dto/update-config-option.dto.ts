import { PartialType } from '@nestjs/mapped-types';
import { CreateConfigOptionDto } from './create-config-option.dto';

export class UpdateConfigOptionDto extends PartialType(CreateConfigOptionDto) {}
