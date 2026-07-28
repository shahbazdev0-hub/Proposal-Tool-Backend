import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { EmailService } from '../email/email.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
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
  constructor(
    private readonly salesService: SalesService,
    private readonly emailService: EmailService,
  ) {}

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
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    const sale = await this.salesService.update(id, dto);
    return SalesService.sanitizeForRole(sale, Role.ADMIN);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/paid')
  markPaid(@Param('id') id: string, @Body('paid') paid: boolean) {
    return this.salesService.markPaid(id, paid);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/install-status')
  markInstalled(
    @Param('id') id: string,
    @Body('status') status: 'not_installed' | 'installed',
  ) {
    return this.salesService.markInstalled(id, status);
  }

  @Post(':id/email')
  async sendEmail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const sale = await this.salesService.findById(id);

    const scopeField = ROLE_SCOPE_FIELD[user.role];
    if (scopeField) {
      const scopedUser = sale[scopeField] as { _id?: { toString(): string } } | null;
      if (scopedUser?._id?.toString() !== user.userId) {
        throw new ForbiddenException("You don't have access to this sale");
      }
    }

    if (!sale.customerEmail) {
      throw new BadRequestException('This sale has no customer email address.');
    }

    const pkg = sale.package as unknown as { name: string };
    const financier = sale.financier as unknown as { name: string } | null;
    const salesRep = sale.salesRep as unknown as { name: string };

    await this.emailService.sendSaleReceipt(sale.customerEmail, {
      customerName: sale.customerName,
      saleDate: sale.saleDate?.toISOString() ?? null,
      installDate: sale.installDate?.toISOString() ?? null,
      waterType: sale.waterType,
      packageName: pkg?.name ?? '—',
      financierName: financier?.name ?? null,
      loanOptionLabel: sale.loanOptionLabel,
      loanAmount: sale.loanAmount,
      salesRepName: salesRep?.name ?? '—',
      commissionAmount: sale.commissions?.salesRep ?? 0,
      commissionsPaid: sale.commissionsPaid,
    });

    return { message: `Receipt sent to ${sale.customerEmail}` };
  }
}
