import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AddersService } from './adders.service';
import { CreateAdderDto } from './dto/create-adder.dto';
import { UpdateAdderDto } from './dto/update-adder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS)
@Controller('adders')
export class AddersController {
  constructor(private readonly addersService: AddersService) {}

  @Get()
  findAll() {
    return this.addersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.addersService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateAdderDto) {
    return this.addersService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdderDto) {
    return this.addersService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.addersService.remove(id);
  }
}
