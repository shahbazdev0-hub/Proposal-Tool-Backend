import { IsHexColor, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyTagline?: string;

  // Uploaded logos are stored as a relative path (/uploads/<file>), so this
  // cannot be @IsUrl. null clears the logo.
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;
}
