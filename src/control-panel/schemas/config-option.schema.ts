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
}

export const ConfigOptionSchema = SchemaFactory.createForClass(ConfigOption);

ConfigOptionSchema.index({ category: 1, label: 1 }, { unique: true });
