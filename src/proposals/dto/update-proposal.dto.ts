import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateProposalDto } from './create-proposal.dto';
import {
  PROPOSAL_STATUSES,
  type ProposalStatus,
} from '../schemas/proposal.schema';

export class UpdateProposalDto extends PartialType(CreateProposalDto) {
  @IsOptional()
  @IsEnum(PROPOSAL_STATUSES)
  status?: ProposalStatus;

  @IsOptional()
  @IsMongoId()
  convertedSaleId?: string;
}
