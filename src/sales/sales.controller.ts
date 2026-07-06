import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// Maps a non-admin/ops role to the Sale field that scopes what they're allowed to see.
const ROLE_SCOPE_FIELD: Partial<
  Record<Role, 'salesRep' | 'directRecruiter' | 'teamLead' | 'regional' | 'partner'>
> = {
  [Role.SALES_REP]: 'salesRep',
  [Role.DIRECT_RECRUITER]: 'directRecruiter',
  [Role.TEAM_LEAD]: 'teamLead',
  [Role.REGIONAL]: 'regional',
  [Role.PARTNER]: 'partner',
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Roles(Role.ADMIN, Role.OPS)
  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: SalesQueryDto) {
    const scopeField = ROLE_SCOPE_FIELD[user.role];
    const restrict = scopeField ? { field: scopeField, userId: user.userId } : undefined;
    const sales = await this.salesService.findAll(query, restrict);
    return sales.map((sale) => SalesService.sanitizeForRole(sale, user.role));
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const sale = await this.salesService.findById(id);

    const scopeField = ROLE_SCOPE_FIELD[user.role];
    if (scopeField) {
      const scopedUser = sale[scopeField] as { _id?: { toString(): string } } | null;
      if (scopedUser?._id?.toString() !== user.userId) {
        throw new ForbiddenException("You don't have access to this sale");
      }
    }

    return SalesService.sanitizeForRole(sale, user.role);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/paid')
  markPaid(@Param('id') id: string, @Body('paid') paid: boolean) {
    return this.salesService.markPaid(id, paid);
  }
}
