import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanciersService } from './financiers.service';
import { FinanciersController } from './financiers.controller';
import { Financier, FinancierSchema } from './schemas/financier.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Financier.name, schema: FinancierSchema }])],
  controllers: [FinanciersController],
  providers: [FinanciersService],
  exports: [FinanciersService],
})
export class FinanciersModule {}
