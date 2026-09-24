import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  // US ZIP, 5 digits or ZIP+4 (12345 or 12345-6789).
  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'zip must be a valid US ZIP code' })
  zip: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
