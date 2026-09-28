import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ProposalDocument = Proposal & Document;

export type ProposalStatus =
  'draft' | 'sent' | 'approved' | 'closed' | 'cancel' | 'converted';

/** Single source of truth for the allowed values, shared with the DTO. */
export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'draft',
  'sent',
  'approved',
  'closed',
  'cancel',
  'converted',
];

// Every ObjectId-typed @Prop below uses MongooseSchema.Types.ObjectId, not
// Types.ObjectId — @nestjs/mongoose's SchemaFactory.createForClass only
// recognises the former as `type:`; the latter silently compiled to a Mixed
// field, dropping the cast on every write. Confirmed by reproducing outside
// the app — see customer.schema.ts for the full explanation.
@Schema({ timestamps: true })
export class Proposal {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  })
  customer: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  salesRep: Types.ObjectId;

  @Prop({ required: true, type: String })
  waterType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Package', required: true })
  package: Types.ObjectId;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Adder' }],
    default: [],
  })
  adders: Types.ObjectId[];

  @Prop({ required: true, min: 0, default: 0 })
  addersTotal: number;

  @Prop({ required: true, min: 0, default: 0 })
  salesMargin: number;

  /** package.price + addersTotal + salesMargin */
  @Prop({ required: true, min: 0 })
  cashPrice: number;

  // ── Financing snapshot (null = cash sale) ──────────────────────────────────

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Financier',
    default: null,
  })
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
    enum: PROPOSAL_STATUSES,
    default: 'draft',
  })
  status: ProposalStatus;

  /** Populated once status === 'converted'. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Sale', default: null })
  convertedSaleId: Types.ObjectId | null;
}

export const ProposalSchema = SchemaFactory.createForClass(Proposal);
