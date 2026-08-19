import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package, PackageDocument } from './schemas/package.schema';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { WaterType } from '../common/enums/water-type.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class PackagesService {
  constructor(@InjectModel(Package.name) private readonly packageModel: Model<PackageDocument>) {}

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
