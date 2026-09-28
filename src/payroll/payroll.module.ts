import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    // Sale is registered once in SharedModelsModule rather than here too —
    // see SharedModelsModule for why duplicate forFeature calls for the
    // same model name were a real bug, not just redundant.
    SharedModelsModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
