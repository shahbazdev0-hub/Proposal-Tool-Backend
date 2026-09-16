import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FinanciersService } from './financiers.service';
import { CreateFinancierDto } from './dto/create-financier.dto';
import { UpdateFinancierDto } from './dto/update-financier.dto';
import { LoanOptionDto } from './dto/loan-option.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@UseGuards(JwtAuthGuard)
@Controller('financiers')
export class FinanciersController {
  constructor(private readonly financiersService: FinanciersService) {}

  // All authenticated users can browse financiers (needed by the proposal wizard)
  @Get()
  findAll() {
    return this.financiersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.financiersService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateFinancierDto) {
    return this.financiersService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFinancierDto) {
    return this.financiersService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.financiersService.remove(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/loan-options')
  addLoanOption(@Param('id') id: string, @Body() dto: LoanOptionDto) {
    return this.financiersService.addLoanOption(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/loan-options/:loanOptionId')
  updateLoanOption(
    @Param('id') id: string,
    @Param('loanOptionId') loanOptionId: string,
    @Body() dto: LoanOptionDto,
  ) {
    return this.financiersService.updateLoanOption(id, loanOptionId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/loan-options/:loanOptionId')
  removeLoanOption(@Param('id') id: string, @Param('loanOptionId') loanOptionId: string) {
    return this.financiersService.removeLoanOption(id, loanOptionId);
  }
}
