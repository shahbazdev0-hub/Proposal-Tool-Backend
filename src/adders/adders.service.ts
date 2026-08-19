import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Adder, AdderDocument } from './schemas/adder.schema';
import { CreateAdderDto } from './dto/create-adder.dto';
import { UpdateAdderDto } from './dto/update-adder.dto';

@Injectable()
export class AddersService {
  constructor(@InjectModel(Adder.name) private readonly adderModel: Model<AdderDocument>) {}

  create(dto: CreateAdderDto): Promise<AdderDocument> {
    const { applicablePackageIds, ...rest } = dto;
    return this.adderModel.create({
      ...rest,
      applicablePackages: applicablePackageIds ?? [],
    });
  }

  findAll(packageId?: string): Promise<AdderDocument[]> {
    const filter =
      packageId
        ? { $or: [{ applicablePackages: { $size: 0 } }, { applicablePackages: packageId }] }
        : {};
    return this.adderModel.find(filter).sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<AdderDocument> {
    const adder = await this.adderModel.findById(id).exec();
    if (!adder) {
      throw new NotFoundException('Adder not found');
    }
    return adder;
  }

  findByIds(ids: string[]): Promise<AdderDocument[]> {
    return this.adderModel.find({ _id: { $in: ids } }).exec();
  }

  async update(id: string, dto: UpdateAdderDto): Promise<AdderDocument> {
    const adder = await this.adderModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!adder) {
      throw new NotFoundException('Adder not found');
    }
    return adder;
  }

  async remove(id: string): Promise<void> {
    const result = await this.adderModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Adder not found');
    }
  }
}
