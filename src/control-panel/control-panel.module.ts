import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ControlPanelService } from './control-panel.service';
import { ControlPanelController } from './control-panel.controller';
import { ConfigOption, ConfigOptionSchema } from './schemas/config-option.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ConfigOption.name, schema: ConfigOptionSchema }]),
  ],
  controllers: [ControlPanelController],
  providers: [ControlPanelService],
  exports: [ControlPanelService],
})
export class ControlPanelModule {}
