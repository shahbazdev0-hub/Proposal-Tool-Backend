import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from './schemas/sale.schema';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { calculateCommission } from './commission-engine';
import { PackagesService } from '../packages/packages.service';
import { AddersService } from '../adders/adders.service';
import { FinanciersService } from '../financiers/financiers.service';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    private readonly packagesService: PackagesService,
    private readonly addersService: AddersService,
    private readonly financiersService: FinanciersService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateSaleDto): Promise<SaleDocument> {
    const pkg = await this.packagesService.findById(dto.package);
    if (pkg.waterType !== dto.waterType) {
      throw new BadRequestException(
        `Package "${pkg.name}" belongs to water type "${pkg.waterType}", not "${dto.waterType}"`,
      );
    }

    const adders = dto.adders?.length ? await this.addersService.findByIds(dto.adders) : [];
    const addersTotal = adders.reduce((sum, adder) => sum + adder.price, 0);

    let dealerFeePercent = 0;
    let loanOptionLabel: string | null = null;
    if (dto.financier) {
      const financier = await this.financiersService.findById(dto.financier);
      const loanOption = financier.loanOptions.find(
        (lo) => lo._id?.toString() === dto.loanOptionId,
      );
      if (!loanOption) {
        throw new NotFoundException('Loan option not found for the selected financier');
      }
      dealerFeePercent = loanOption.dealerFeePercent;
      loanOptionLabel = loanOption.label;
    }

    const salesRep = await this.usersService.findByIdLean(dto.salesRep);

    const commissions = calculateCommission({
      waterType: dto.waterType,
      package: {
        price: pkg.price,
        repCommissionFlat: pkg.repCommissionFlat,
        overrides: pkg.overrides,
        nickOverride: pkg.nickOverride,
      },
      loanAmount: dto.loanAmount,
      dealerFeePercent,
      addersTotal,
    });

    // Mongoose may not auto-cast stored string IDs to ObjectId on these fields;
    // cast explicitly so MongoDB stores them as the correct BSON type for $match.
    const toOid = (val: unknown): Types.ObjectId | null => {
      if (!val) return null;
      if (val instanceof Types.ObjectId) return val;
      return new Types.ObjectId(val.toString());
    };

    return this.saleModel.create({
      customerName: dto.customerName,
      saleDate: dto.saleDate,
      installDate: dto.installDate ?? null,
      financier: dto.financier ? new Types.ObjectId(dto.financier) : null,
      loanOptionLabel,
      dealerFeePercent,
      loanAmount: dto.loanAmount,
      waterType: dto.waterType,
      package: pkg._id,
      adders: adders.map((adder) => adder._id),
      addersTotal,
      salesRep: salesRep._id,
      directRecruiter: toOid(salesRep.directRecruiter),
      teamLead: toOid(salesRep.teamLead),
      regional: toOid(salesRep.regional),
      partner: toOid(salesRep.partner),
      commissions,
      commissionsPaid: false,
      paidDate: null,
    });
  }

  // `restrict` scopes results to deals a given non-admin role is allowed to see —
  // e.g. a Team Lead only sees deals where they are the snapshotted teamLead.
  findAll(
    query: SalesQueryDto,
    restrict?: { field: 'salesRep' | 'directRecruiter' | 'teamLead' | 'regional' | 'partner'; userId: string },
  ): Promise<SaleDocument[]> {
    const filter: Record<string, unknown> = {};

    if (query.from || query.to) {
      const saleDate: Record<string, Date> = {};
      if (query.from) saleDate.$gte = new Date(query.from);
      if (query.to) saleDate.$lte = new Date(query.to);
      filter.saleDate = saleDate;
    }

    if (query.salesRep) {
      filter.salesRep = new Types.ObjectId(query.salesRep);
    }

    if (restrict) {
      filter[restrict.field] = new Types.ObjectId(restrict.userId);
    }

    return this.saleModel
      .find(filter)
      .populate(['package', 'adders', 'financier', 'salesRep', 'directRecruiter', 'teamLead', 'regional', 'partner'])
      .sort({ saleDate: -1 })
      .exec();
  }

  async findById(id: string): Promise<SaleDocument> {
    const sale = await this.saleModel
      .findById(id)
      .populate(['package', 'adders', 'financier', 'salesRep', 'directRecruiter', 'teamLead', 'regional', 'partner'])
      .exec();
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }

  async markPaid(id: string, paid: boolean): Promise<SaleDocument> {
    const sale = await this.saleModel
      .findByIdAndUpdate(id, { commissionsPaid: paid, paidDate: paid ? new Date() : null }, { new: true })
      .exec();
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }

  // Nick's override must never reach a non-admin client — strip it at the edge.
  static sanitizeForRole(sale: SaleDocument, role: Role): Record<string, unknown> {
    const plain = sale.toJSON() as Record<string, unknown> & {
      commissions: Record<string, unknown>;
    };
    if (role === Role.ADMIN) {
      return plain;
    }
    const { nickOverride, ...commissions } = plain.commissions;
    return { ...plain, commissions };
  }
}
