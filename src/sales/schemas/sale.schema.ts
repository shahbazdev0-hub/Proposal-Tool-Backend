import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
@Schema({ _id: false })
export class CommissionBreakdown {
  @Prop({ required: true })
  salesRep: number;

  @Prop({ required: true })
  directRecruiter: number;

  @Prop({ required: true })
  teamLead: number;

  @Prop({ required: true })
  regional: number;

  @Prop({ required: true })
  partner: number;

  @Prop({ required: true })
  nickOverride: number;
}

export const CommissionBreakdownSchema = SchemaFactory.createForClass(CommissionBreakdown);

export type SaleDocument = Sale & Document;

@Schema({ timestamps: true })
export class Sale {
  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ type: String, trim: true, default: null })
  customerEmail: string | null;

  @Prop({ required: true })
  saleDate: Date;

  @Prop({ type: Date, default: null })
  installDate: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Financier', default: null })
  financier: Types.ObjectId | null;

  // Snapshots of the chosen loan option, taken at sale time so historical
  // commissions never shift if the financier's rates change later.
  @Prop({ type: String, default: null })
  loanOptionLabel: string | null;

  @Prop({ required: true, min: 0, default: 0 })
  dealerFeePercent: number;

  @Prop({ required: true, min: 0 })
  loanAmount: number;

  @Prop({ required: true, type: String })
  waterType: string;

  @Prop({ type: Types.ObjectId, ref: 'Package', required: true })
  package: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Adder' }], default: [] })
  adders: Types.ObjectId[];

  @Prop({ required: true, min: 0, default: 0 })
  addersTotal: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  salesRep: Types.ObjectId;

  // Upline snapshot at time of sale — deliberately decoupled from the User
  // document so promoting/reassigning a rep later doesn't rewrite history.
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  directRecruiter: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  teamLead: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  regional: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  partner: Types.ObjectId | null;

  @Prop({ type: CommissionBreakdownSchema, required: true })
  commissions: CommissionBreakdown;

  @Prop({ default: false })
  commissionsPaid: boolean;

  @Prop({ type: Date, default: null })
  paidDate: Date | null;

  @Prop({ type: String, enum: ['not_installed', 'installed'], default: 'not_installed' })
  installStatus: 'not_installed' | 'installed';
}

export const SaleSchema = SchemaFactory.createForClass(Sale);
