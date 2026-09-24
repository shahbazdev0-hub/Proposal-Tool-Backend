import { IsMongoId } from 'class-validator';

export class TransferCustomerDto {
  /** The user who becomes the new owner (Customer.createdBy). */
  @IsMongoId()
  ownerId: string;
}
