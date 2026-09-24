import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, trim: true })
  name: string;

  /** Full formatted address ("123 Main St, Austin, TX 78701"), derived from
   *  the structured fields below on every create/update — kept so every
   *  existing display, the PDF, and the print template can go on reading a
   *  single string. */
  @Prop({ required: true, trim: true })
  address: string;

  // Not required at the schema level — customers created before this field
  // existed have no value here, only in the combined `address` string above.
  // The DTO requires all four for every new create.
  @Prop({ type: String, trim: true, default: null })
  street: string | null;

  @Prop({ type: String, trim: true, default: null })
  city: string | null;

  @Prop({ type: String, trim: true, uppercase: true, default: null })
  state: string | null;

  @Prop({ type: String, trim: true, default: null })
  zip: string | null;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, trim: true, default: null })
  notes: string | null;

  /** The rep who created this customer record. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
