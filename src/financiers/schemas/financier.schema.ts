import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: true })
export class LoanOption {
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, min: 0, max: 100 })
  dealerFeePercent: number;
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
