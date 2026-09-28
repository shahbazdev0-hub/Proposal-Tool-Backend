import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { EmailModule } from '../email/email.module';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Gives UsersService the SAME Proposal/Customer/Sale model instances
    // CustomersModule/ProposalsModule/SalesModule use — needed so it can
    // check "is this user referenced anywhere" before a hard delete, without
    // importing those modules directly (they already import UsersModule;
    // that would be circular). See SharedModelsModule for why this can't
    // just be its own MongooseModule.forFeature call for the same names.
    SharedModelsModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
