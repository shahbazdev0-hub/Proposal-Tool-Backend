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

export const PackageOverridesSchema =
  SchemaFactory.createForClass(PackageOverrides);

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

  /**
   * Static = the rep cannot move the price at all; commission is this package's
   * own flat/percent commission value below, overriding the water-type-based
   * formula in commission-engine.ts. Dynamic = the rep may add margin up to
   * maxMarginValue (flat or percent); commission follows the normal per-sale
   * waterfall. Replaces the old marginEnabled boolean — the two states aren't
   * independent, so one switch is the single source of truth.
   */
  @Prop({ type: String, enum: ['static', 'dynamic'], default: 'dynamic' })
  pricingMode: 'static' | 'dynamic';

  /** Dynamic only. Whether maxMarginValue is a dollar ceiling or a percent of price. */
  @Prop({ type: String, enum: ['flat', 'percent'], default: 'flat' })
  maxMarginType: 'flat' | 'percent';

  /**
   * Dynamic only. null = inherit the product's ceiling (ConfigOption.maxMargin
   * for this package's productType, always flat $). A number is an explicit
   * override in whatever unit maxMarginType says, including 0.
   */
  @Prop({ type: Number, default: null, min: 0 })
  maxMarginValue: number | null;

  /** Static only. Whether repCommissionValue is a flat dollar amount or a percent of cash price. */
  @Prop({ type: String, enum: ['flat', 'percent'], default: 'flat' })
  repCommissionType: 'flat' | 'percent';

  /** Static only — flat or percent Sales Rep commission, replacing the
   *  water-type-based formula. Null = fall back to that formula (e.g. a
   *  Static package that hasn't had a commission value configured yet). */
  @Prop({ type: Number, default: null, min: 0 })
  repCommissionValue: number | null;

  // Deprecated — superseded by repCommissionType/repCommissionValue above,
  // kept only so existing Homewater packages written before this field
  // existed keep working until re-saved. Do not use in new code.
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

  // Deprecated — superseded by pricingMode (false ≈ "static", true ≈
  // "dynamic"). Kept only for the one-time migration that backfills
  // pricingMode on packages written before this field existed; do not read
  // this in new code.
  @Prop({ default: true })
  marginEnabled: boolean;

  // Deprecated — superseded by maxMarginType/maxMarginValue above. Kept only
  // for the migration backfill; do not read this in new code.
  @Prop({ type: Number, default: null, min: 0 })
  maxMargin: number | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
