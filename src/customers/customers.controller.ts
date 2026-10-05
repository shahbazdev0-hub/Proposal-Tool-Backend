import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { TransferCustomerDto } from './dto/transfer-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /** Admin-only — managing the customer list directly (the Customers page's
   *  "Add Customer"). A rep creating a customer inline while starting a
   *  proposal uses POST /customers/for-proposal instead, which is open to
   *  any authenticated user — see that route for why this isn't just a
   *  client-supplied flag on this one. */
  @Post()
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin can add a customer.');
    }
    return this.customersService.create(dto, user.userId);
  }

  /**
   * Same create, open to any authenticated user — specifically for the
   * proposal wizard's "+ New Customer" step. Reps keep the ability to start
   * a proposal for someone not already in the system (most proposals begin
   * this way); only the standalone Customers page's "Add Customer" is
   * admin-only. A separate route rather than a flag on POST /customers
   * because a flag like `fromWizard: true` would just be something anyone
   * calling the API directly could set to bypass the restriction above.
   */
  @Post('for-proposal')
  createForProposal(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findAll(user.userId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findByIdForUser(id, user.userId, user.role);
  }

  /** Admin-only edit — see CustomersService.update. */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.update(id, dto, user.role);
  }

  /** Admin-only ownership transfer — see CustomersService.transfer. */
  @Patch(':id/transfer')
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.transfer(id, dto, user.role);
  }

  /** Admin-only delete — see CustomersService.remove. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.remove(id, user.role);
  }
}
