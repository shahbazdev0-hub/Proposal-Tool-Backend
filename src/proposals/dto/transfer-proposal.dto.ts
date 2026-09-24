import { IsMongoId } from 'class-validator';

export class TransferProposalDto {
  /** The user who becomes the new owner (Proposal.salesRep). */
  @IsMongoId()
  salesRepId: string;
}
