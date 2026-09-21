import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigOption, ConfigOptionDocument } from './schemas/config-option.schema';
import { CreateConfigOptionDto } from './dto/create-config-option.dto';
import { UpdateConfigOptionDto } from './dto/update-config-option.dto';

@Injectable()
export class ControlPanelService {
  constructor(
    @InjectModel(ConfigOption.name)
    private readonly optionModel: Model<ConfigOptionDocument>,
  ) {}

  findByCategory(category: string): Promise<ConfigOptionDocument[]> {
    return this.optionModel
      .find({ category })
      .sort({ label: 1 })
      .exec();
  }

  findAll(): Promise<ConfigOptionDocument[]> {
    return this.optionModel.find().sort({ category: 1, label: 1 }).exec();
  }

  async create(dto: CreateConfigOptionDto): Promise<ConfigOptionDocument> {
    try {
      return await this.optionModel.create(dto);
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          `"${dto.label}" already exists in category "${dto.category}"`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateConfigOptionDto): Promise<ConfigOptionDocument> {
    const option = await this.optionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!option) throw new NotFoundException('Config option not found');
    return option;
  }

  async remove(id: string): Promise<void> {
    const result = await this.optionModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Config option not found');
  }
}
