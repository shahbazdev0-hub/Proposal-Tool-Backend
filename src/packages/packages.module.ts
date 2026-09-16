import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { Package, PackageSchema } from './schemas/package.schema';
import { UsersModule } from '../users/users.module';
import { ControlPanelModule } from '../control-panel/control-panel.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Package.name, schema: PackageSchema }]),
    UsersModule,
    ControlPanelModule,
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
