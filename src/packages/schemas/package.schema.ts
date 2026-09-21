import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
@Schema({ _id: false })
export class PackageOverrides {
  @Prop({ required: true, min: 0, default: 0 })
  directRecruiter: number;

  @Prop({ required: true, min: 0, default: 0 })
  teamLead: number;

  @Prop({ required: true, min: 0, default: 0 })
  regional: number;

  @Prop({ required: true, min: 0, default: 0 })
  partner: number;
}

export const PackageOverridesSchema = SchemaFactory.createForClass(PackageOverrides);

export type PackageDocument = Package & Document;

@Schema({ timestamps: true })
export class Package {
  @Prop({ type: String, trim: true, default: null })
  productType: string | null;

  @Prop({ required: true, type: String })
  waterType: string;

  @Prop({ required: true, trim: true })
  name: string;

  // Supreme: base/cash package price, subtracted in the rep commission waterfall.
  // Homewater: list price, kept for reference only — commission is the flat amount below.
  @Prop({ required: true, min: 0 })
  price: number;

  // Homewater only — flat Sales Rep commission. Null for Supreme (computed dynamically per sale).
  @Prop({ type: Number, default: null })
  repCommissionFlat: number | null;

  // Fixed per-tier overrides. For Homewater, only directRecruiter is ever paid out
  // (teamLead/regional/partner are stored as 0 — see commission engine).
  @Prop({ type: PackageOverridesSchema, required: true })
  overrides: PackageOverrides;

  // Hidden override visible to Admin only — never exposed to non-admin roles.
  @Prop({ required: true, min: 0, default: 0 })
  nickOverride: number;

  /** Bullet-point inclusions shown on the customer proposal PDF. */
  @Prop({ type: [String], default: [] })
  inclusions: string[];

  /** Product image shown on the customer-facing proposal. */
  @Prop({ type: String, trim: true, default: null })
  imageUrl: string | null;

  /**
   * Whether a rep may add any sales margin to this package (scope §11,
   * "enable/disable margin where necessary"). Kept separate from maxMargin so
   * "margin is switched off" and "the ceiling happens to be zero" stay
   * distinguishable — an admin reading a 0 can otherwise not tell which.
   */
  @Prop({ default: true })
  marginEnabled: boolean;

  /**
   * Maximum sales margin in dollars. null = inherit the product's ceiling
   * (ConfigOption.maxMargin for this package's productType). A number is an
   * explicit override, including 0.
   */
  @Prop({ type: Number, default: null, min: 0 })
  maxMargin: number | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
