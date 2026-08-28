import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalsService } from './proposals.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalsController } from './proposals.controller';
import { Proposal, ProposalSchema } from './schemas/proposal.schema';
import { PackagesModule } from '../packages/packages.module';
import { AddersModule } from '../adders/adders.module';
import { FinanciersModule } from '../financiers/financiers.module';
import { SettingsModule } from '../settings/settings.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Proposal.name, schema: ProposalSchema }]),
    PackagesModule,
    AddersModule,
    FinanciersModule,
    SettingsModule,
    EmailModule,
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalPdfService],
})
export class ProposalsModule {}
