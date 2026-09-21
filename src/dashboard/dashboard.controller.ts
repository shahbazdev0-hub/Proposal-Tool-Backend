import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService, ScopeField } from './dashboard.service';
import { SalesQueryDto } from '../sales/dto/sales-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const ROLE_SCOPE_FIELD: Partial<Record<Role, ScopeField>> = {
  [Role.SALES_REP]: 'salesRep',
  [Role.DIRECT_RECRUITER]: 'directRecruiter',
  [Role.TEAM_LEAD]: 'teamLead',
  [Role.REGIONAL]: 'regional',
  [Role.PARTNER]: 'partner',
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getStats(@CurrentUser() user: AuthenticatedUser, @Query() query: SalesQueryDto) {
    if (user.role === Role.ADMIN || user.role === Role.OPS) {
      return this.dashboardService.getAdminStats(query, user.role === Role.ADMIN);
    }

    const scopeField = ROLE_SCOPE_FIELD[user.role];
    return this.dashboardService.getPersonalStats(query, scopeField as ScopeField, user.userId);
  }
}
