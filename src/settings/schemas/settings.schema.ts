import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ timestamps: true })
export class Settings {
  /** Singleton identifier — always 'company'. */
  @Prop({ required: true, unique: true, default: 'company' })
  key: string;

  @Prop({ required: true, trim: true, default: 'My Company' })
  companyName: string;

  @Prop({ type: String, trim: true, default: null })
  companyTagline: string | null;

  /** Full URL to the company logo image. */
  @Prop({ type: String, trim: true, default: null })
  logoUrl: string | null;

  /** Primary brand color (hex, e.g. #1e3a5f). */
  @Prop({ type: String, default: '#1e293b' })
  primaryColor: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
