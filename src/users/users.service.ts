import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import {
  Proposal,
  ProposalDocument,
} from '../proposals/schemas/proposal.schema';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';

const SALT_ROUNDS = 10;

// How long an invite / password-set link stays valid.
const PASSWORD_SET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Mongoose does not always auto-cast string hex values to ObjectId for
// reference fields defined via @Prop({ type: Types.ObjectId }). To guarantee
// the correct BSON type is stored (required for $match filters in aggregation
// and for .find() with ObjectId equality), cast explicitly before any write.
const UPLINE_FIELDS = [
  'directRecruiter',
  'teamLead',
  'regional',
  'partner',
] as const;

function castUplineIds(obj: Record<string, unknown>): void {
  for (const field of UPLINE_FIELDS) {
    if (typeof obj[field] === 'string' && obj[field]) {
      obj[field] = new Types.ObjectId(obj[field]);
    }
  }
}

// allowedPackages arrives from JSON as string[]; cast so the ObjectId $in
// filter in PackagesService matches. Same reasoning as castUplineIds above.
function castAllowedPackages(obj: Record<string, unknown>): void {
  const raw = obj['allowedPackages'];
  if (Array.isArray(raw)) {
    obj['allowedPackages'] = raw
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map((v) => new Types.ObjectId(v));
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
  ) {}

  /**
   * Creates a user. If no password was given, the account is created with
   * none set — the returned `inviteToken` is the raw, one-time token for the
   * emailed "set your password" link (the caller, UsersController, sends
   * that email; this service only knows about persistence). If a password
   * WAS given, it's hashed immediately and no invite is needed.
   */
  async create(
    dto: CreateUserDto,
  ): Promise<{ user: UserDocument; inviteToken: string | null }> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const { password, ...rest } = dto;
    const payload: Record<string, unknown> = { ...rest };
    castUplineIds(payload);
    castAllowedPackages(payload);

    let inviteToken: string | null = null;
    if (password) {
      payload.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    } else {
      inviteToken = randomBytes(32).toString('hex');
      payload.passwordSetTokenHash = hashToken(inviteToken);
      payload.passwordSetTokenExpires = new Date(
        Date.now() + PASSWORD_SET_TOKEN_TTL_MS,
      );
    }

    const created = await this.userModel.create(payload);
    // create()'s return value ignores the schema's `select: false` on
    // passwordHash (that only applies to find-style queries) — re-fetch so
    // the hash never reaches the response.
    const user = await this.findById(created._id.toString());
    return { user, inviteToken };
  }

  /**
   * Consumes a set-password token (from an invite or a future forgot-password
   * flow): sets the new password and clears the token so it can't be reused.
   * Throws if the token doesn't match any user or has expired.
   */
  async setPasswordWithToken(
    token: string,
    password: string,
  ): Promise<UserDocument> {
    const tokenHash = hashToken(token);
    const user = await this.userModel
      .findOne({ passwordSetTokenHash: tokenHash })
      .select('+passwordSetTokenHash +passwordSetTokenExpires')
      .exec();

    if (
      !user ||
      !user.passwordSetTokenExpires ||
      user.passwordSetTokenExpires < new Date()
    ) {
      throw new BadRequestException('This link is invalid or has expired.');
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.passwordSetTokenHash = null;
    user.passwordSetTokenExpires = null;
    await user.save();

    return this.findById(user._id.toString());
  }

  /**
   * Issues a fresh set-password token for an existing user — the
   * forgot-password entry point. Always succeeds (no "does this email
   * exist" signal) so the controller can respond identically whether or not
   * the address is registered.
   */
  async generatePasswordSetToken(
    email: string,
  ): Promise<{ token: string; name: string } | null> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();
    if (!user || !user.isActive) return null;

    const token = randomBytes(32).toString('hex');
    user.passwordSetTokenHash = hashToken(token);
    user.passwordSetTokenExpires = new Date(
      Date.now() + PASSWORD_SET_TOKEN_TTL_MS,
    );
    await user.save();
    return { token, name: user.name };
  }

  findAll(): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .populate(['directRecruiter', 'teamLead', 'regional', 'partner'])
      .sort({ name: 1 })
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .populate(['directRecruiter', 'teamLead', 'regional', 'partner'])
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // No populate — used when only the raw upline ObjectIds are needed (e.g.
  // snapshotting onto a Sale), so we don't pull full user docs for nothing.
  async findByIdLean(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  /**
   * A sales rep's own id plus every rep who has this user in one of their
   * four upline slots (Direct Recruiter, Team Lead, Regional, Partner) —
   * the "who may see this rep's proposals/customers" set. Access is by
   * relationship, not by the requester's own role: whoever a rep's admin
   * put in one of those four slots for THAT rep sees THAT rep's records,
   * even if two people hold the same role (e.g. two Regionals) and only one
   * of them is this rep's actual Regional.
   */
  async visibleSalesRepIds(userId: string): Promise<Types.ObjectId[]> {
    const id = new Types.ObjectId(userId);
    const downline = await this.userModel
      .find({
        $or: UPLINE_FIELDS.map((field) => ({ [field]: id })),
      })
      .select('_id')
      .exec();
    return [id, ...downline.map((u) => u._id)];
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const updates: Record<string, unknown> = { ...dto };

    if (dto.password) {
      updates.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      delete updates.password;
    }

    castUplineIds(updates);
    castAllowedPackages(updates);

    const user = await this.userModel
      .findByIdAndUpdate(id, updates, { new: true })
      .populate(['directRecruiter', 'teamLead', 'regional', 'partner'])
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateSelf(id: string, dto: UpdateSelfDto): Promise<UserDocument> {
    const updates: Record<string, unknown> = { ...dto };
    if (dto.password) {
      updates.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      delete updates.password;
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, updates, { new: true })
      .populate(['directRecruiter', 'teamLead', 'regional', 'partner'])
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deactivate(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Permanently removes a user. Unlike deactivate(), this can never be
   * undone, so it's refused outright if the user is referenced anywhere —
   * their own proposals/customers, a sale attributed to them at any upline
   * level, or another user's Direct Recruiter/Team Lead/Regional/Partner
   * slot. Deactivate is still the right move for someone who has history;
   * this is for records that were never real (duplicates, test accounts).
   */
  async remove(id: string): Promise<void> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    const objectId = user._id;
    const [proposalCount, customerCount, saleCount, uplineCount] =
      await Promise.all([
        this.proposalModel.countDocuments({ salesRep: objectId }).exec(),
        this.customerModel.countDocuments({ createdBy: objectId }).exec(),
        this.saleModel
          .countDocuments({
            $or: [
              { salesRep: objectId },
              { directRecruiter: objectId },
              { teamLead: objectId },
              { regional: objectId },
              { partner: objectId },
            ],
          })
          .exec(),
        this.userModel
          .countDocuments({
            $or: UPLINE_FIELDS.map((field) => ({ [field]: objectId })),
          })
          .exec(),
      ]);

    const blockers: string[] = [];
    if (proposalCount > 0) blockers.push(`${proposalCount} proposal(s)`);
    if (customerCount > 0) blockers.push(`${customerCount} customer(s)`);
    if (saleCount > 0) blockers.push(`${saleCount} sale(s)`);
    if (uplineCount > 0) blockers.push(`${uplineCount} other user's upline`);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Can't delete this user — they're referenced by ${blockers.join(', ')}. ` +
          `Deactivate them instead, or reassign those records first.`,
      );
    }

    await this.userModel.findByIdAndDelete(id).exec();
  }
}
