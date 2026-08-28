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

// Every read of a proposal hydrates the same references — keep the list in one
// place so a field added here can't be missed by one of the call sites.
const POPULATE = [
  { path: 'customer', select: 'name email phone address' },
  { path: 'salesRep', select: 'name email' },
  { path: 'package', select: 'name price waterType inclusions maxMargin imageUrl' },
  { path: 'adders', select: 'name price' },
  { path: 'financier', select: 'name' },
];

/** Everything priced from a proposal's inputs. */
interface PricedProposal {
  waterType: string;
  package: string;
  adders: string[];
  addersTotal: number;
  salesMargin: number;
  cashPrice: number;
  financier: string | null;
  loanOptionLabel: string | null;
  dealerFeePercent: number;
  dealerFee: number;
  financedAmount: number;
  monthlyPayment: number | null;
  loanTerm: number | null;
  interestRate: number | null;
}

@Injectable()
export class ProposalsService {
  constructor(
    @InjectModel(Proposal.name) private readonly proposalModel: Model<ProposalDocument>,
    private readonly packagesService: PackagesService,
    private readonly addersService: AddersService,
    private readonly financiersService: FinanciersService,
  ) {}

  /**
   * Single source of truth for proposal pricing. Both create and update run
   * through here so an edited proposal is validated and priced exactly like a
   * new one — client-supplied totals are never trusted.
   */
  private async price(
    dto: CreateProposalDto,
    salesRepId: string,
    role: Role,
  ): Promise<PricedProposal> {
    // Catalog access is enforced on the write path too — a rep must not be able
    // to quote a package they were never granted by POSTing its id directly.
    await this.packagesService.assertUserMayUse(salesRepId, role, dto.packageId);
    const pkg = await this.packagesService.findById(dto.packageId);

    // waterType is denormalised onto the proposal for reporting; if it
    // disagreed with the package the two would drift apart silently.
    if (dto.waterType !== pkg.waterType) {
      throw new BadRequestException(
        `Water type "${dto.waterType}" does not match the selected package.`,
      );
    }

    // Only adders actually applicable to this package may be attached, and
    // inactive ones are rejected rather than silently priced at zero.
    const adderIds = dto.adderIds ?? [];
    let addersTotal = 0;
    if (adderIds.length > 0) {
      const applicable = await this.addersService.findAll(dto.packageId);
      const selected = applicable.filter(
        (a) => adderIds.includes(a._id.toString()) && a.isActive,
      );
      if (selected.length !== adderIds.length) {
        throw new BadRequestException(
          'One or more selected adders are inactive or not available for this package.',
        );
      }
      addersTotal = selected.reduce((sum, a) => sum + a.price, 0);
    }

    // Margin cap. maxMargin of 0 means "no margin allowed" (see Package schema),
    // so the ceiling is enforced unconditionally — including at zero.
    const maxMargin = pkg.maxMargin ?? 0;
    if (dto.salesMargin > maxMargin) {
      throw new BadRequestException(
        maxMargin === 0
          ? 'This package does not allow a sales margin.'
          : `Sales margin cannot exceed $${maxMargin} for this package.`,
      );
    }

    const cashPrice = pkg.price + addersTotal + dto.salesMargin;

    // ── Financing (absent = cash sale) ────────────────────────────────────────
    let financier: string | null = null;
    let loanOptionLabel: string | null = null;
    let dealerFeePercent = 0;
    let dealerFee = 0;
    let financedAmount = 0;
    let monthlyPayment: number | null = null;
    let loanTerm: number | null = null;
    let interestRate: number | null = null;

    if (dto.financierId && dto.loanOptionId) {
      const f = await this.financiersService.findById(dto.financierId);
      const loanOption = f.loanOptions.find((lo) => lo._id?.toString() === dto.loanOptionId);
      if (!loanOption) throw new NotFoundException('Loan option not found');
      if (!loanOption.isActive) {
        throw new BadRequestException('That financing program is no longer active.');
      }

      financier = dto.financierId;
      loanOptionLabel = loanOption.label;
      dealerFeePercent = loanOption.dealerFeePercent;
      dealerFee = cashPrice * (dealerFeePercent / 100);
      financedAmount = cashPrice + dealerFee;
      loanTerm = loanOption.loanTerm ?? null;
      interestRate = loanOption.interestRate ?? null;

      if (loanOption.paymentFactor != null && loanOption.paymentFactor > 0) {
        monthlyPayment = (financedAmount / 1000) * loanOption.paymentFactor;
      }
    }

    return {
      waterType: dto.waterType,
      package: dto.packageId,
      adders: adderIds,
      addersTotal,
      salesMargin: dto.salesMargin,
      cashPrice,
      financier,
      loanOptionLabel,
      dealerFeePercent,
      dealerFee,
      financedAmount,
      monthlyPayment,
      loanTerm,
      interestRate,
    };
  }

  async create(
    dto: CreateProposalDto,
    salesRepId: string,
    role: Role,
  ): Promise<ProposalDocument> {
    const priced = await this.price(dto, salesRepId, role);
    const created = await this.proposalModel.create({
      customer: dto.customerId,
      salesRep: salesRepId,
      ...priced,
    });
    return this.findById(String(created._id));
  }

  findAll(requestingUserId: string, role: Role): Promise<ProposalDocument[]> {
    const filter =
      role === Role.ADMIN || role === Role.OPS ? {} : { salesRep: requestingUserId };
    return this.proposalModel.find(filter).sort({ createdAt: -1 }).populate(POPULATE).exec();
  }

  async findById(id: string): Promise<ProposalDocument> {
    const proposal = await this.proposalModel.findById(id).populate(POPULATE).exec();
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  async update(id: string, dto: UpdateProposalDto, role: Role): Promise<ProposalDocument> {
    const existing = await this.findById(id);

    const idOf = (v: unknown): string =>
      (v as { _id?: { toString(): string } })?._id?.toString() ?? String(v);

    const updates: Record<string, unknown> = {};
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.convertedSaleId !== undefined) updates.convertedSaleId = dto.convertedSaleId;

    // Any change to a priced input re-runs the whole calculation, so an edited
    // proposal can never carry stale totals or slip past the margin cap. This
    // replaces the old create-then-delete round trip, which also clobbered
    // createdAt.
    const touchesPricing = [
      dto.customerId,
      dto.waterType,
      dto.packageId,
      dto.adderIds,
      dto.salesMargin,
      dto.financierId,
      dto.loanOptionId,
    ].some((f) => f !== undefined);

    if (touchesPricing) {
      const priced = await this.price(
        {
          customerId: dto.customerId ?? idOf(existing.customer),
          waterType: dto.waterType ?? existing.waterType,
          packageId: dto.packageId ?? idOf(existing.package),
          adderIds: dto.adderIds ?? existing.adders.map(idOf),
          salesMargin: dto.salesMargin ?? existing.salesMargin,
          financierId:
            dto.financierId ?? (existing.financier ? idOf(existing.financier) : undefined),
          loanOptionId: dto.loanOptionId,
        },
        idOf(existing.salesRep),
        role,
      );
      Object.assign(updates, priced);
      if (dto.customerId) updates.customer = dto.customerId;
    }

    const updated = await this.proposalModel
      .findByIdAndUpdate(id, updates, { new: true })
      .populate(POPULATE)
      .exec();
    if (!updated) throw new NotFoundException('Proposal not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.proposalModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Proposal not found');
  }
}
