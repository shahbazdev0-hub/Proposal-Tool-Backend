import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';

const SALT_ROUNDS = 10;

// Mongoose does not always auto-cast string hex values to ObjectId for
// reference fields defined via @Prop({ type: Types.ObjectId }). To guarantee
// the correct BSON type is stored (required for $match filters in aggregation
// and for .find() with ObjectId equality), cast explicitly before any write.
const UPLINE_FIELDS = ['directRecruiter', 'teamLead', 'regional', 'partner'] as const;
type UplineField = (typeof UPLINE_FIELDS)[number];

function castUplineIds(obj: Record<string, unknown>): void {
  for (const field of UPLINE_FIELDS) {
    if (typeof obj[field] === 'string' && obj[field]) {
      obj[field] = new Types.ObjectId(obj[field] as string);
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
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { password, ...rest } = dto;
    const payload = { ...rest, passwordHash };
    castUplineIds(payload);
    castAllowedPackages(payload);

    const created = await this.userModel.create(payload);
    // create()'s return value ignores the schema's `select: false` on
    // passwordHash (that only applies to find-style queries) — re-fetch so
    // the hash never reaches the response.
    return this.findById((created._id as Types.ObjectId).toString());
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
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
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
    const user = await this.userModel.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
