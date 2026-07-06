import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WaterType } from '../../common/enums/water-type.enum';

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
  @Prop({ required: true, enum: WaterType })
  waterType: WaterType;

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

  @Prop({ default: true })
  isActive: boolean;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
