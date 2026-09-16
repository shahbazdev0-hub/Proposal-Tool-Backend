import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Sale.name, schema: SaleSchema }])],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
