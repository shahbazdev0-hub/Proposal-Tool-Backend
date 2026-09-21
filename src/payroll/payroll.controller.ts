import { Controller, Get, Header, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { SalesQueryDto } from '../sales/dto/sales-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  getReport(@Query() query: SalesQueryDto) {
    return this.payrollService.getReport(query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll.csv"')
  async exportCsv(@Query() query: SalesQueryDto): Promise<StreamableFile> {
    const csv = await this.payrollService.exportCsv(query);
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  @Get('export.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="payroll.xlsx"')
  async exportExcel(@Query() query: SalesQueryDto): Promise<StreamableFile> {
    const buffer = await this.payrollService.exportExcel(query);
    return new StreamableFile(Buffer.from(buffer));
  }
}
