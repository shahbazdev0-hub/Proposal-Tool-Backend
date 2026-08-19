import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: true })
export class LoanOption {
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, min: 0, max: 100 })
  dealerFeePercent: number;

  /** Loan term in months (e.g. 120 = 10 years). Optional — informational. */
  @Prop({ type: Number, default: null })
  loanTerm: number | null;

  /** Annual Percentage Rate (e.g. 9.99). Optional — informational. */
  @Prop({ type: Number, default: null })
  interestRate: number | null;

  /** Monthly payment per $1,000 financed (e.g. 10.46). Used to compute monthly payment. */
  @Prop({ type: Number, default: null })
  paymentFactor: number | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const LoanOptionSchema = SchemaFactory.createForClass(LoanOption);

export type FinancierDocument = Financier & Document;

@Schema({ timestamps: true })
export class Financier {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: [LoanOptionSchema], default: [] })
  loanOptions: LoanOption[];

  @Prop({ default: true })
  isActive: boolean;
}

export const FinancierSchema = SchemaFactory.createForClass(Financier);
