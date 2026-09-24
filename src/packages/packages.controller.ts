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
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { WaterType } from '../common/enums/water-type.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('waterType') waterType?: WaterType,
  ) {
    const packages = await this.packagesService.findAllForUser(
      user.userId,
      user.role,
      waterType,
    );
    return this.packagesService.presentMany(packages, user.role);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.packagesService.assertUserMayUse(user.userId, user.role, id);
    const pkg = await this.packagesService.findById(id);
    return this.packagesService.presentOne(pkg, user.role);
  }

  // Writes return the same enriched shape as reads, so a client never sees a
  // package without its resolved margin policy.
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePackageDto,
  ) {
    const pkg = await this.packagesService.create(dto);
    return this.packagesService.presentOne(pkg, user.role);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    const pkg = await this.packagesService.update(id, dto);
    return this.packagesService.presentOne(pkg, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.packagesService.remove(id);
  }
}
