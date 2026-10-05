import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AdderDocument = Adder & Document;

@Schema({ timestamps: true })
export class Adder {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  /**
   * Static = the rep must use `price` exactly, no input. Dynamic = the rep
   * may raise the price by up to `maxExtra` on top of `price`, same shape as
   * a package's sales margin.
   */
  @Prop({ type: String, enum: ['static', 'dynamic'], default: 'static' })
  pricingMode: 'static' | 'dynamic';

  /** Dynamic only. null = no ceiling (rep may add any amount). */
  @Prop({ type: Number, default: null, min: 0 })
  maxExtra: number | null;

  @Prop({ default: true })
  isActive: boolean;

  /** Thumbnail shown beside this upgrade on the customer-facing proposal. */
  @Prop({ type: String, trim: true, default: null })
  imageUrl: string | null;

  // MongooseSchema.Types.ObjectId, not Types.ObjectId — the latter silently
  // compiled to a Mixed field under @nestjs/mongoose's SchemaFactory. See
  // customer.schema.ts for the full explanation.
  /** Empty = applies to all packages. Non-empty = only shown for listed packages. */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Package' }],
    default: [],
  })
  applicablePackages: Types.ObjectId[];
}

export const AdderSchema = SchemaFactory.createForClass(Adder);
