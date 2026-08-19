import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AddersService } from './adders.service';
import { CreateAdderDto } from './dto/create-adder.dto';
import { UpdateAdderDto } from './dto/update-adder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@UseGuards(JwtAuthGuard)
@Controller('adders')
export class AddersController {
  constructor(private readonly addersService: AddersService) {}

  // All authenticated users can browse adders (needed by the proposal wizard for all roles)
  @Get()
  findAll(@Query('packageId') packageId?: string) {
    return this.addersService.findAll(packageId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.addersService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateAdderDto) {
    return this.addersService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdderDto) {
    return this.addersService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.addersService.remove(id);
  }
}
