import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProposalDocument = Proposal & Document;

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';

@Schema({ timestamps: true })
export class Proposal {
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  salesRep: Types.ObjectId;

  @Prop({ required: true, type: String })
  waterType: string;

  @Prop({ type: Types.ObjectId, ref: 'Package', required: true })
  package: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Adder' }], default: [] })
  adders: Types.ObjectId[];

  @Prop({ required: true, min: 0, default: 0 })
  addersTotal: number;

  @Prop({ required: true, min: 0, default: 0 })
  salesMargin: number;

  /** package.price + addersTotal + salesMargin */
  @Prop({ required: true, min: 0 })
  cashPrice: number;

  // ── Financing snapshot (null = cash sale) ──────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'Financier', default: null })
  financier: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  loanOptionLabel: string | null;

  @Prop({ type: Number, default: 0 })
  dealerFeePercent: number;

  @Prop({ type: Number, default: 0 })
  dealerFee: number;

  @Prop({ type: Number, default: 0 })
  financedAmount: number;

  @Prop({ type: Number, default: null })
  monthlyPayment: number | null;

  @Prop({ type: Number, default: null })
  loanTerm: number | null;

  @Prop({ type: Number, default: null })
  interestRate: number | null;

  // ── Status ─────────────────────────────────────────────────────────────────

  @Prop({
    type: String,
    enum: ['draft', 'sent', 'accepted', 'declined', 'converted'],
    default: 'draft',
  })
  status: ProposalStatus;

  /** Populated once status === 'converted'. */
  @Prop({ type: Types.ObjectId, ref: 'Sale', default: null })
  convertedSaleId: Types.ObjectId | null;
}

export const ProposalSchema = SchemaFactory.createForClass(Proposal);
