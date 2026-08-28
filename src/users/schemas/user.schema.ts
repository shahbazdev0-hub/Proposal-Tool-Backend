import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  office?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, enum: Role })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  /**
   * Catalog access control (scope §3). Empty = this user may quote every active
   * package. Non-empty = the user only sees and may quote the listed packages.
   * Mirrors the Adder.applicablePackages convention.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Package' }], default: [] })
  allowedPackages: Types.ObjectId[];

  // Upline chain — who this user's deals roll commissions up to.
  // Set by Admin only; drives override payouts in the commission engine.
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  directRecruiter?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  teamLead?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  regional?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  partner?: Types.ObjectId | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
