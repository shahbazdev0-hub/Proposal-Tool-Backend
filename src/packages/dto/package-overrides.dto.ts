import { IsNumber, Min } from 'class-validator';

export class PackageOverridesDto {
  @IsNumber()
  @Min(0)
  directRecruiter: number;

  @IsNumber()
  @Min(0)
  teamLead: number;

  @IsNumber()
  @Min(0)
  regional: number;

  @IsNumber()
  @Min(0)
  partner: number;
}
