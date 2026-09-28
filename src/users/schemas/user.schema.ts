import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
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

  // Not required at the schema level: a freshly invited user has no password
  // yet — they set one via the emailed invite link. The login flow rejects
  // anyone with no hash set (see AuthService), so this never grants access.
  @Prop({ type: String, select: false, default: null })
  passwordHash: string | null;

  @Prop({ required: true, enum: Role })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  // Every ObjectId-typed @Prop below uses MongooseSchema.Types.ObjectId, not
  // Types.ObjectId — @nestjs/mongoose's SchemaFactory.createForClass only
  // recognises the former as `type:`; the latter silently compiled to a
  // Mixed field, dropping the cast on every write. See customer.schema.ts.
  // (castUplineIds() in users.service.ts was a manual workaround for this
  // exact gap on the write path — now redundant but left in place, since
  // it's still a correct explicit cast either way.)
  /**
   * Catalog access control (scope §3). Empty = this user may quote every active
   * package. Non-empty = the user only sees and may quote the listed packages.
   * Mirrors the Adder.applicablePackages convention.
   */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Package' }],
    default: [],
  })
  allowedPackages: Types.ObjectId[];

  // Upline chain — who this user's deals roll commissions up to.
  // Set by Admin only; drives override payouts in the commission engine.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, default: null })
  directRecruiter?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, default: null })
  teamLead?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, default: null })
  regional?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, default: null })
  partner?: Types.ObjectId | null;

  // Set-password token — used both for the initial invite (sent on create,
  // when no password was given) and for a future "forgot password" flow.
  // The raw token is only ever in the emailed link; this stores its SHA-256
  // hash, so a database read alone can't be used to set someone's password.
  @Prop({ type: String, select: false, default: null })
  passwordSetTokenHash?: string | null;

  @Prop({ type: Date, select: false, default: null })
  passwordSetTokenExpires?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
