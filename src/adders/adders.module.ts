import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddersService } from './adders.service';
import { AddersController } from './adders.controller';
import { Adder, AdderSchema } from './schemas/adder.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Adder.name, schema: AdderSchema }])],
  controllers: [AddersController],
  providers: [AddersService],
  exports: [AddersService],
})
export class AddersModule {}
