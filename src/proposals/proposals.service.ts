import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Proposal, ProposalDocument } from './schemas/proposal.schema';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { PackagesService } from '../packages/packages.service';
import { AddersService } from '../adders/adders.service';
import { FinanciersService } from '../financiers/financiers.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ProposalsService {
  constructor(
    @InjectModel(Proposal.name) private readonly proposalModel: Model<ProposalDocument>,
    private readonly packagesService: PackagesService,
    private readonly addersService: AddersService,
    private readonly financiersService: FinanciersService,
  ) {}

  async create(dto: CreateProposalDto, salesRepId: string): Promise<ProposalDocument> {
    // Resolve package
    const pkg = await this.packagesService.findById(dto.packageId);

    // Resolve adders and sum total
    const adderIds = dto.adderIds ?? [];
    let addersTotal = 0;
    if (adderIds.length > 0) {
      const allAdders = await this.addersService.findAll();
      const selectedAdders = allAdders.filter((a) => adderIds.includes(a._id.toString()));
      addersTotal = selectedAdders.reduce((sum, a) => sum + a.price, 0);
    }

    // Validate margin
    const maxMargin = pkg.maxMargin ?? 0;
    if (dto.salesMargin > maxMargin && maxMargin > 0) {
      throw new BadRequestException(
        `Sales margin cannot exceed $${maxMargin} for this package.`,
      );
    }

    // Cash price = package price + adders + margin
    const cashPrice = pkg.price + addersTotal + dto.salesMargin;

    // Financing
    let financierId: string | null = dto.financierId ?? null;
    let loanOptionLabel: string | null = null;
    let dealerFeePercent = 0;
    let dealerFee = 0;
    let financedAmount = 0;
    let monthlyPayment: number | null = null;
    let loanTerm: number | null = null;
    let interestRate: number | null = null;

    if (dto.financierId && dto.loanOptionId) {
      const financier = await this.financiersService.findById(dto.financierId);
      const loanOption = financier.loanOptions.find(
        (lo) => lo._id?.toString() === dto.loanOptionId,
      );
      if (!loanOption) throw new NotFoundException('Loan option not found');

      loanOptionLabel = loanOption.label;
      dealerFeePercent = loanOption.dealerFeePercent;
      dealerFee = cashPrice * (dealerFeePercent / 100);
      financedAmount = cashPrice + dealerFee;
      loanTerm = loanOption.loanTerm ?? null;
      interestRate = loanOption.interestRate ?? null;

      if (loanOption.paymentFactor != null && loanOption.paymentFactor > 0) {
        monthlyPayment = (financedAmount / 1000) * loanOption.paymentFactor;
      }
    } else {
      financierId = null;
    }

    return this.proposalModel.create({
      customer: dto.customerId,
      salesRep: salesRepId,
      waterType: dto.waterType,
      package: dto.packageId,
      adders: adderIds,
      addersTotal,
      salesMargin: dto.salesMargin,
      cashPrice,
      financier: financierId,
      loanOptionLabel,
      dealerFeePercent,
      dealerFee,
      financedAmount,
      monthlyPayment,
      loanTerm,
      interestRate,
    });
  }

  findAll(requestingUserId: string, role: Role): Promise<ProposalDocument[]> {
    const filter =
      role === Role.ADMIN || role === Role.OPS ? {} : { salesRep: requestingUserId };
    return this.proposalModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('customer', 'name email phone address')
      .populate('salesRep', 'name email')
      .populate('package', 'name price waterType inclusions')
      .populate('adders', 'name price')
      .populate('financier', 'name')
      .exec();
  }

  async findById(id: string): Promise<ProposalDocument> {
    const proposal = await this.proposalModel
      .findById(id)
      .populate('customer', 'name email phone address')
      .populate('salesRep', 'name email')
      .populate('package', 'name price waterType inclusions maxMargin')
      .populate('adders', 'name price')
      .populate('financier', 'name')
      .exec();
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  async update(id: string, dto: UpdateProposalDto): Promise<ProposalDocument> {
    // If only status/convertedSaleId is being updated, apply directly.
    const directFields: Record<string, unknown> = {};
    if (dto.status !== undefined) directFields['status'] = dto.status;
    if (dto.convertedSaleId !== undefined) directFields['convertedSaleId'] = dto.convertedSaleId;

    if (Object.keys(directFields).length > 0 && !dto.packageId) {
      const updated = await this.proposalModel
        .findByIdAndUpdate(id, directFields, { new: true })
        .populate('customer', 'name email phone address')
        .populate('salesRep', 'name email')
        .populate('package', 'name price waterType inclusions maxMargin')
        .populate('adders', 'name price')
        .populate('financier', 'name')
        .exec();
      if (!updated) throw new NotFoundException('Proposal not found');
      return updated;
    }

    // Full recalculation when proposal content changes
    const existing = await this.findById(id);
    const salesRepId = (existing.salesRep as any)?._id?.toString() ?? existing.salesRep.toString();
    const merged: CreateProposalDto = {
      customerId: dto.customerId ?? (existing.customer as any)?._id?.toString() ?? existing.customer.toString(),
      waterType: dto.waterType ?? existing.waterType,
      packageId: dto.packageId ?? (existing.package as any)?._id?.toString() ?? existing.package.toString(),
      adderIds: dto.adderIds ?? existing.adders.map((a: any) => a._id?.toString() ?? a.toString()),
      salesMargin: dto.salesMargin ?? existing.salesMargin,
      financierId: dto.financierId ?? (existing.financier as any)?._id?.toString() ?? undefined,
      loanOptionId: dto.loanOptionId,
    };

    const fresh = await this.create(merged, salesRepId);
    await this.proposalModel.findByIdAndDelete(fresh._id);

    const updated = await this.proposalModel
      .findByIdAndUpdate(
        id,
        {
          ...fresh.toObject(),
          _id: undefined,
          status: dto.status ?? existing.status,
        },
        { new: true },
      )
      .populate('customer', 'name email phone address')
      .populate('salesRep', 'name email')
      .populate('package', 'name price waterType inclusions maxMargin')
      .populate('adders', 'name price')
      .populate('financier', 'name')
      .exec();
    if (!updated) throw new NotFoundException('Proposal not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.proposalModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Proposal not found');
  }
}
