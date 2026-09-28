import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    // Sale/Proposal are registered once in SharedModelsModule rather than
    // here too — see SharedModelsModule for why a second forFeature call
    // for the same model name was a real bug (silently uncast ObjectId
    // writes), not just redundant.
    SharedModelsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
