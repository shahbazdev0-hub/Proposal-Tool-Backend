import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PackagesModule } from '../packages/packages.module';
import { AddersModule } from '../adders/adders.module';
import { FinanciersModule } from '../financiers/financiers.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    // Sale's Mongoose model is registered once in SharedModelsModule (also
    // used by UsersModule) rather than here too — see SharedModelsModule
    // for why a second forFeature call for the same model name was the
    // actual bug.
    SharedModelsModule,
    PackagesModule,
    AddersModule,
    FinanciersModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
