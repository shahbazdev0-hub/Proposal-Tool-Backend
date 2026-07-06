import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdderDocument = Adder & Document;

@Schema({ timestamps: true })
export class Adder {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const AdderSchema = SchemaFactory.createForClass(Adder);
