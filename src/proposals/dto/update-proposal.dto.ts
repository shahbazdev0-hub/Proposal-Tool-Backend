import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateProposalDto } from './create-proposal.dto';
import type { ProposalStatus } from '../schemas/proposal.schema';

export class UpdateProposalDto extends PartialType(CreateProposalDto) {
  @IsOptional()
  @IsEnum(['draft', 'sent', 'accepted', 'declined', 'converted'])
  status?: ProposalStatus;

  @IsOptional()
  @IsMongoId()
  convertedSaleId?: string;
}
