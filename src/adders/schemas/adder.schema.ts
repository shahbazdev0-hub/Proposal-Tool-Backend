import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdderDocument = Adder & Document;

@Schema({ timestamps: true })
export class Adder {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  isActive: boolean;

  /** Empty = applies to all packages. Non-empty = only shown for listed packages. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Package' }], default: [] })
  applicablePackages: Types.ObjectId[];
}

export const AdderSchema = SchemaFactory.createForClass(Adder);
