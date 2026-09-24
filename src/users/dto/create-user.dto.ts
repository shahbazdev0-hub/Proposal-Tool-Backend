import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
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

  // Optional: leave blank to invite the user by email instead — they'll set
  // their own password via a link. Provided only for the rare case an admin
  // wants to set one directly without sending an invite.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

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

  /** Empty/omitted = access to all packages. */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  allowedPackages?: string[];
}
