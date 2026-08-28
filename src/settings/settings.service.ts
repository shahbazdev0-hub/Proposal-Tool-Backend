import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SINGLETON_KEY = 'company';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  async get(): Promise<SettingsDocument> {
    const existing = await this.settingsModel.findOne({ key: SINGLETON_KEY }).exec();
    if (existing) return existing;
    // Auto-create defaults on first access
    return this.settingsModel.create({ key: SINGLETON_KEY });
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsDocument> {
    const settings = await this.settingsModel
      .findOneAndUpdate({ key: SINGLETON_KEY }, dto, { new: true, upsert: true })
      .exec();
    return settings!;
  }
}
