import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { ControlPanelService } from '../control-panel/control-panel.service';
import { ConfigOptionDocument } from '../control-panel/schemas/config-option.schema';
import { Package, PackageDocument } from './schemas/package.schema';
import { ConfigOption } from '../control-panel/schemas/config-option.schema';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { WaterType } from '../common/enums/water-type.enum';
import { Role } from '../common/enums/role.enum';

/** The margin rules that actually apply to a package, after inheritance. */
export interface MarginPolicy {
  /** false = no margin may be added at all. */
  enabled: boolean;
  /** Ceiling in dollars. Only meaningful when enabled. */
  cap: number;
  /** Where the ceiling came from, for display in the admin UI. */
  source: 'package' | 'product' | 'none';
}

const PRODUCT_TYPE_CATEGORY = 'product_type';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
    private readonly usersService: UsersService,
    private readonly controlPanelService: ControlPanelService,
  ) {}

  /** Products are Control Panel options, matched to a package by label. */
  private static matchProduct(
    options: ConfigOptionDocument[],
    productType: string | null | undefined,
  ): ConfigOptionDocument | null {
    if (!productType) return null;
    const key = productType.trim().toLowerCase();
    return options.find((o) => o.label.trim().toLowerCase() === key) ?? null;
  }

  /**
   * Scope §11: the ceiling is settable "by package/product". A package-level
   * value always wins; null means inherit the product's. Either level can
   * switch margin off entirely, and disabling at the product level disables it
   * for every package underneath.
   */
  static resolveMarginPolicy(
    pkg: Pick<Package, 'marginEnabled' | 'maxMargin'>,
    product: Pick<ConfigOption, 'marginEnabled' | 'maxMargin'> | null,
  ): MarginPolicy {
    const enabled =
      (product?.marginEnabled ?? true) && (pkg.marginEnabled ?? true);
    if (!enabled) return { enabled: false, cap: 0, source: 'none' };
    if (pkg.maxMargin != null) {
      return { enabled: true, cap: pkg.maxMargin, source: 'package' };
    }
    if (product?.maxMargin != null) {
      return { enabled: true, cap: product.maxMargin, source: 'product' };
    }
    return { enabled: true, cap: 0, source: 'none' };
  }

  /** Policy for a single package, resolving its product on the way. */
  async getMarginPolicy(pkg: PackageDocument): Promise<MarginPolicy> {
    const options = await this.controlPanelService.findByCategory(
      PRODUCT_TYPE_CATEGORY,
    );
    return PackagesService.resolveMarginPolicy(
      pkg,
      PackagesService.matchProduct(options, pkg.productType),
    );
  }

  /**
   * Sanitises for the role and attaches the resolved policy, so clients never
   * have to re-implement the inheritance rules.
   */
  async presentMany(
    packages: PackageDocument[],
    role: Role,
  ): Promise<Record<string, unknown>[]> {
    const options = await this.controlPanelService.findByCategory(
      PRODUCT_TYPE_CATEGORY,
    );
    return packages.map((pkg) => {
      const policy = PackagesService.resolveMarginPolicy(
        pkg,
        PackagesService.matchProduct(options, pkg.productType),
      );
      return {
        ...PackagesService.sanitizeForRole(pkg, role),
        effectiveMarginEnabled: policy.enabled,
        effectiveMaxMargin: policy.cap,
        marginSource: policy.source,
      };
    });
  }

  async presentOne(
    pkg: PackageDocument,
    role: Role,
  ): Promise<Record<string, unknown>> {
    const [presented] = await this.presentMany([pkg], role);
    return presented;
  }

  // Admin and Ops run the catalog, so they always see everything. For everyone
  // else an empty allowedPackages list means "no restriction configured" — the
  // same convention Adder.applicablePackages uses. Resolved per request rather
  // than baked into the JWT so revoking access takes effect immediately.
  private async allowedIdsFor(
    userId: string,
    role: Role,
  ): Promise<Types.ObjectId[] | null> {
    if (role === Role.ADMIN || role === Role.OPS) return null;
    const user = await this.usersService.findByIdLean(userId);
    const allowed = user.allowedPackages ?? [];
    return allowed.length > 0 ? allowed : null;
  }

  async findAllForUser(
    userId: string,
    role: Role,
    waterType?: WaterType,
  ): Promise<PackageDocument[]> {
    const filter: Record<string, unknown> = waterType ? { waterType } : {};
    const allowed = await this.allowedIdsFor(userId, role);
    if (allowed) filter._id = { $in: allowed };
    return this.packageModel.find(filter).sort({ price: -1 }).exec();
  }

  // Guards the write path: a rep must not be able to quote a package they were
  // never granted, even by POSTing its id directly.
  async assertUserMayUse(
    userId: string,
    role: Role,
    packageId: string,
  ): Promise<void> {
    const allowed = await this.allowedIdsFor(userId, role);
    if (!allowed) return;
    if (!allowed.some((id) => id.toString() === packageId)) {
      throw new ForbiddenException('You do not have access to this package.');
    }
  }

  create(dto: CreatePackageDto): Promise<PackageDocument> {
    return this.packageModel.create(dto);
  }

  findAll(waterType?: WaterType): Promise<PackageDocument[]> {
    const filter = waterType ? { waterType } : {};
    return this.packageModel.find(filter).sort({ price: -1 }).exec();
  }

  async findById(id: string): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async update(id: string, dto: UpdatePackageDto): Promise<PackageDocument> {
    const pkg = await this.packageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async remove(id: string): Promise<void> {
    const result = await this.packageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Package not found');
    }
  }

  // Nick's override must never reach a non-admin client — strip it at the edge.
  static sanitizeForRole(
    pkg: PackageDocument,
    role: Role,
  ): Record<string, unknown> {
    const plain = pkg.toJSON() as Record<string, unknown>;
    if (role === Role.ADMIN) {
      return plain;
    }
    const { nickOverride, ...rest } = plain;
    return rest;
  }
}
