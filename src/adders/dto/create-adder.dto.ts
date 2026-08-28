import { IsArray, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAdderDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  applicablePackageIds?: string[];
}
