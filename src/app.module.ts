import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FinanciersModule } from './financiers/financiers.module';
import { AddersModule } from './adders/adders.module';
import { PackagesModule } from './packages/packages.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PayrollModule } from './payroll/payroll.module';
import { ControlPanelModule } from './control-panel/control-panel.module';
import { CustomersModule } from './customers/customers.module';
import { ProposalsModule } from './proposals/proposals.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodbUri'),
      }),
    }),
    AuthModule,
    UsersModule,
    FinanciersModule,
    AddersModule,
    PackagesModule,
    SalesModule,
    DashboardModule,
    PayrollModule,
    ControlPanelModule,
    CustomersModule,
    ProposalsModule,
    SettingsModule,
  ],
})
export class AppModule {}
