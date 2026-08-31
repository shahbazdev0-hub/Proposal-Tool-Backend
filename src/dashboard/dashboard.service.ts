import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { Proposal, ProposalDocument } from '../proposals/schemas/proposal.schema';
import { SalesQueryDto } from '../sales/dto/sales-query.dto';

export type ScopeField = 'salesRep' | 'directRecruiter' | 'teamLead' | 'regional' | 'partner';

// Fixed order so the status chart keeps a stable, meaningful sequence rather
// than whatever order the aggregation happens to return.
const STATUS_ORDER = ['draft', 'sent', 'accepted', 'declined', 'converted'] as const;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Proposal.name) private readonly proposalModel: Model<ProposalDocument>,
  ) {}

  private buildDateFilter(query: SalesQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.from || query.to) {
      const saleDate: Record<string, Date> = {};
      if (query.from) saleDate.$gte = new Date(query.from);
      if (query.to) saleDate.$lte = new Date(query.to);
      filter.saleDate = saleDate;
    }
    return filter;
  }

  // Sales are dated by saleDate; proposals only have createdAt, so the same
  // range has to be applied to a different field.
  private buildProposalDateFilter(query: SalesQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }
    return filter;
  }

  private async getProposalStats(filter: Record<string, unknown>) {
    const rows = await this.proposalModel.aggregate<{
      status: string;
      count: number;
      value: number;
    }>([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$cashPrice' } } },
      { $project: { _id: 0, status: '$_id', count: 1, value: 1 } },
    ]);

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
    const convertedRow = rows.find((r) => r.status === 'converted');
    const converted = convertedRow?.count ?? 0;
    const convertedValue = convertedRow?.value ?? 0;
    const accepted = rows.find((r) => r.status === 'accepted')?.count ?? 0;

    // Open pipeline = still winnable: drafted, sent or accepted but not yet a sale.
    const openValue = rows
      .filter((r) => r.status === 'draft' || r.status === 'sent' || r.status === 'accepted')
      .reduce((sum, r) => sum + r.value, 0);

    const proposalsByStatus = STATUS_ORDER.map(
      (status) => rows.find((r) => r.status === status) ?? { status, count: 0, value: 0 },
    ).filter((r) => r.count > 0);

    return {
      proposals: {
        total,
        totalValue,
        openValue,
        accepted,
        converted,
        convertedValue,
        conversionRate: total > 0 ? (converted / total) * 100 : 0,
      },
      proposalsByStatus,
    };
  }

  async getAdminStats(query: SalesQueryDto, includeNickOverride: boolean) {
    const filter = this.buildDateFilter(query);

    const [totals] = await this.saleModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$loanAmount' },
          totalCommissionOwed: {
            $sum: {
              $cond: [
                '$commissionsPaid',
                0,
                {
                  $add: [
                    '$commissions.salesRep',
                    '$commissions.directRecruiter',
                    '$commissions.teamLead',
                    '$commissions.regional',
                    '$commissions.partner',
                    includeNickOverride ? '$commissions.nickOverride' : 0,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const salesByProduct = await this.saleModel.aggregate([
      { $match: filter },
      { $group: { _id: '$package', count: { $sum: 1 }, revenue: { $sum: '$loanAmount' } } },
      { $lookup: { from: 'packages', localField: '_id', foreignField: '_id', as: 'package' } },
      { $unwind: '$package' },
      {
        $project: {
          _id: 0,
          package: '$package.name',
          waterType: '$package.waterType',
          count: 1,
          revenue: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    const salesByRepresentative = await this.saleModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$salesRep',
          count: { $sum: 1 },
          revenue: { $sum: '$loanAmount' },
          commission: { $sum: '$commissions.salesRep' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'rep' } },
      { $unwind: '$rep' },
      { $project: { _id: 0, name: '$rep.name', count: 1, revenue: 1, commission: 1 } },
      { $sort: { revenue: -1 } },
    ]);

    const { proposals, proposalsByStatus } = await this.getProposalStats(
      this.buildProposalDateFilter(query),
    );

    return {
      totalSales: totals?.totalSales ?? 0,
      totalRevenue: totals?.totalRevenue ?? 0,
      totalCommissionOwed: totals?.totalCommissionOwed ?? 0,
      salesByProduct,
      salesByRepresentative,
      proposals,
      proposalsByStatus,
    };
  }

  async getPersonalStats(query: SalesQueryDto, field: ScopeField, userId: string) {
    const filter = { ...this.buildDateFilter(query), [field]: new Types.ObjectId(userId) };

    const [totals] = await this.saleModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          commissionEarned: { $sum: `$commissions.${field}` },
          commissionPaid: {
            $sum: { $cond: ['$commissionsPaid', `$commissions.${field}`, 0] },
          },
          commissionDue: {
            $sum: { $cond: ['$commissionsPaid', 0, `$commissions.${field}`] },
          },
        },
      },
    ]);

    // Proposals only record the rep who wrote them — there is no upline chain on
    // a proposal — so every non-admin role sees their own, matching the scoping
    // ProposalsService.findAll already applies to the proposals list.
    const { proposals, proposalsByStatus } = await this.getProposalStats({
      ...this.buildProposalDateFilter(query),
      salesRep: new Types.ObjectId(userId),
    });

    return {
      totalSales: totals?.totalSales ?? 0,
      commissionEarned: totals?.commissionEarned ?? 0,
      commissionPaid: totals?.commissionPaid ?? 0,
      commissionDue: totals?.commissionDue ?? 0,
      proposals,
      proposalsByStatus,
    };
  }
}
