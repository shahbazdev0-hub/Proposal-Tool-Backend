import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateConfigOptionDto {
  /** Product-level margin policy; only used when category is 'product_type'. */
  @IsOptional()
  @IsBoolean()
  marginEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxMargin?: number | null;

  // Uploaded images are a relative path (/uploads/<file>), so not @IsUrl.
  // null clears the image.
  @IsOptional()
  @IsString()
  imageUrl?: string | null;


  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
