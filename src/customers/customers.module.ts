import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { UsersModule } from '../users/users.module';
import { SharedModelsModule } from '../common/shared-models.module';

@Module({
  imports: [
    // Customer's Mongoose model is registered once in SharedModelsModule
    // (also used by UsersModule) rather than here too — a second
    // forFeature call for the same model name silently produced a second
    // compiled model that didn't apply the schema's ObjectId cast on
    // write. See SharedModelsModule for the full story.
    SharedModelsModule,
    UsersModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
