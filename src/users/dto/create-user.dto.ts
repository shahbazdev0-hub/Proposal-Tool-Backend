import { IsEmail, IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  office?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsMongoId()
  directRecruiter?: string;

  @IsOptional()
  @IsMongoId()
  teamLead?: string;

  @IsOptional()
  @IsMongoId()
  regional?: string;

  @IsOptional()
  @IsMongoId()
  partner?: string;
}
