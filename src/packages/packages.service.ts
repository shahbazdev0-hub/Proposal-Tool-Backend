import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { Package, PackageDocument } from './schemas/package.schema';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { WaterType } from '../common/enums/water-type.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name) private readonly packageModel: Model<PackageDocument>,
    private readonly usersService: UsersService,
  ) {}

  // Admin and Ops run the catalog, so they always see everything. For everyone
  // else an empty allowedPackages list means "no restriction configured" — the
  // same convention Adder.applicablePackages uses. Resolved per request rather
  // than baked into the JWT so revoking access takes effect immediately.
  private async allowedIdsFor(userId: string, role: Role): Promise<Types.ObjectId[] | null> {
    if (role === Role.ADMIN || role === Role.OPS) return null;
    const user = await this.usersService.findByIdLean(userId);
    const allowed = user.allowedPackages ?? [];
    return allowed.length > 0 ? allowed : null;
  }

  async findAllForUser(
    userId: string,
    role: Role,
    waterType?: WaterType,
  ): Promise<PackageDocument[]> {
    const filter: Record<string, unknown> = waterType ? { waterType } : {};
    const allowed = await this.allowedIdsFor(userId, role);
    if (allowed) filter._id = { $in: allowed };
    return this.packageModel.find(filter).sort({ price: -1 }).exec();
  }

  // Guards the write path: a rep must not be able to quote a package they were
  // never granted, even by POSTing its id directly.
  async assertUserMayUse(userId: string, role: Role, packageId: string): Promise<void> {
    const allowed = await this.allowedIdsFor(userId, role);
    if (!allowed) return;
    if (!allowed.some((id) => id.toString() === packageId)) {
      throw new ForbiddenException('You do not have access to this package.');
    }
  }

  create(dto: CreatePackageDto): Promise<PackageDocument> {
    return this.packageModel.create(dto);
  }

  findAll(waterType?: WaterType): Promise<PackageDocument[]> {
    const filter = waterType ? { waterType } : {};
    return this.packageModel.find(filter).sort({ price: -1 }).exec();
  }

  async findById(id: string): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async update(id: string, dto: UpdatePackageDto): Promise<PackageDocument> {
    const pkg = await this.packageModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async remove(id: string): Promise<void> {
    const result = await this.packageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Package not found');
    }
  }

  // Nick's override must never reach a non-admin client — strip it at the edge.
  static sanitizeForRole(pkg: PackageDocument, role: Role): Record<string, unknown> {
    const plain = pkg.toJSON() as Record<string, unknown>;
    if (role === Role.ADMIN) {
      return plain;
    }
    const { nickOverride, ...rest } = plain;
    return rest;
  }
}
