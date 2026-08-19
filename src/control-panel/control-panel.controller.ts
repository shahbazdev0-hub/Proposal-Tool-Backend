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
import { ControlPanelService } from './control-panel.service';
import { CreateConfigOptionDto } from './dto/create-config-option.dto';
import { UpdateConfigOptionDto } from './dto/update-config-option.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('control-panel')
export class ControlPanelController {
  constructor(private readonly controlPanelService: ControlPanelService) {}

  // All authenticated users can read options (so forms can populate datalists)
  @Get('options')
  findOptions(@Query('category') category?: string) {
    if (category) return this.controlPanelService.findByCategory(category);
    return this.controlPanelService.findAll();
  }

  @Roles(Role.ADMIN)
  @Post('options')
  create(@Body() dto: CreateConfigOptionDto) {
    return this.controlPanelService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('options/:id')
  update(@Param('id') id: string, @Body() dto: UpdateConfigOptionDto) {
    return this.controlPanelService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('options/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.controlPanelService.remove(id);
  }
}
