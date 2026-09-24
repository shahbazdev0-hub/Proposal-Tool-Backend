import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { EmailModule } from '../email/email.module';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';

@Module({
  imports: [
    // Proposal/Customer/Sale are registered here (not via their own modules)
    // so UsersService can check "is this user referenced anywhere" before a
    // hard delete — those modules already import UsersModule, so importing
    // them back here would be circular. Registering the raw schemas avoids
    // that without either module depending on the other.
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Sale.name, schema: SaleSchema },
    ]),
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
