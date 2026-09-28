import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';

/**
 * A handful of models (Customer, Proposal, Sale) need to be injectable in
 * more than one feature module — e.g. UsersService counts references to a
 * user across all three before a hard delete, without UsersModule
 * depending on CustomersModule/ProposalsModule/SalesModule (which already
 * depend on UsersModule; that would be circular).
 *
 * Registering the same { name, schema } pair via MongooseModule.forFeature
 * in two different modules is the actual bug this file fixes: Nest treats
 * each forFeature call as its own provider registration rather than
 * de-duplicating by model name, so two calls for "Customer" produced two
 * separate compiled Mongoose models from what looked like the same schema —
 * and the second one silently didn't apply the ObjectId cast on write,
 * storing ids as plain strings (which then failed every $in visibility
 * filter elsewhere, with no error at any point).
 *
 * Fix: register each shared model's forFeature here, exactly once, and have
 * every module that needs it import THIS module instead of calling
 * forFeature again with the same name. Nest resolves a module already in
 * the graph once (singleton), so this really does mean one model instance
 * end to end, not "hopefully-identical" duplicates.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: Sale.name, schema: SaleSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SharedModelsModule {}
