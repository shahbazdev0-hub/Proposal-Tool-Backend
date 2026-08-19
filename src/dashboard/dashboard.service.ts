import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { SalesQueryDto } from '../sales/dto/sales-query.dto';

export type ScopeField = 'salesRep' | 'directRecruiter' | 'teamLead' | 'regional' | 'partner';

@Injectable()
export class DashboardService {
  constructor(@InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>) {}

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

    return {
      totalSales: totals?.totalSales ?? 0,
      totalRevenue: totals?.totalRevenue ?? 0,
      totalCommissionOwed: totals?.totalCommissionOwed ?? 0,
      salesByProduct,
      salesByRepresentative,
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

    return {
      totalSales: totals?.totalSales ?? 0,
      commissionEarned: totals?.commissionEarned ?? 0,
      commissionPaid: totals?.commissionPaid ?? 0,
      commissionDue: totals?.commissionDue ?? 0,
    };
  }
}
