import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConfigOptionDocument = ConfigOption & Document;

@Schema({ timestamps: true })
export class ConfigOption {
  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ default: true })
  isActive: boolean;

  // ── Margin policy (only meaningful for category === 'product_type') ────────
  // Scope §11 requires a maximum margin settable "by package/product". These
  // hold the product-level default; a package may override it.

  /** false = no margin may be added to any package of this product. */
  @Prop({ default: true })
  marginEnabled: boolean;

  /** Default ceiling for packages of this product. null = no product default. */
  @Prop({ type: Number, default: null, min: 0 })
  maxMargin: number | null;

  /**
   * Product image shown on every proposal for this product (product_type only).
   * An uploaded path (/uploads/<file>) or an external URL.
   */
  @Prop({ type: String, trim: true, default: null })
  imageUrl: string | null;
}

export const ConfigOptionSchema = SchemaFactory.createForClass(ConfigOption);

ConfigOptionSchema.index({ category: 1, label: 1 }, { unique: true });
