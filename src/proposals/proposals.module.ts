import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalsController } from './proposals.controller';
import { PackagesModule } from '../packages/packages.module';
import { AddersModule } from '../adders/adders.module';
import { FinanciersModule } from '../financiers/financiers.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    // Proposal's Mongoose model is registered once in SharedModelsModule
    // (also used by UsersModule) rather than here too — see
    // SharedModelsModule for why a second forFeature call for the same
    // model name was the actual bug.
    SharedModelsModule,
    PackagesModule,
    AddersModule,
    FinanciersModule,
    SettingsModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalPdfService],
})
export class ProposalsModule {}
